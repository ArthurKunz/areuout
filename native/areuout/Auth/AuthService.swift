import AuthenticationServices
import CryptoKit
import Foundation
import GoogleSignIn
import Supabase
import UIKit

/// Alle Wege zum Konto. Dieselben Aufrufe wie die Web-App (features/auth/services/auth.service.ts).
enum AuthService {
    // MARK: Nonce

    /// Apple und Google legen den gehashten Nonce ins ID-Token; Supabase hasht den rohen und
    /// vergleicht, so lässt sich ein gestohlenes Token nicht wiederverwenden.
    static func makeNonce() -> (raw: String, hashed: String) {
        var bytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        let raw = bytes.map { String(format: "%02x", $0) }.joined()
        let hashed = SHA256.hash(data: Data(raw.utf8)).map { String(format: "%02x", $0) }.joined()
        return (raw, hashed)
    }

    // MARK: Apple

    static func signInWithApple(credential: ASAuthorizationAppleIDCredential, rawNonce: String) async throws {
        guard let tokenData = credential.identityToken, let idToken = String(data: tokenData, encoding: .utf8) else {
            throw AuthFailure("Apple hat kein Token geschickt.")
        }
        let response = try await supabase.auth.signInWithIdToken(
            credentials: OpenIDConnectCredentials(provider: .apple, idToken: idToken, nonce: rawNonce)
        )
        // Apple schickt den Namen nur beim allerersten Mal. Er landet in den Metadaten und
        // dient dem Onboarding als Vorschlag, wie in der Web-App.
        let given = credential.fullName?.givenName?.trimmingCharacters(in: .whitespaces) ?? ""
        let family = credential.fullName?.familyName?.trimmingCharacters(in: .whitespaces) ?? ""
        if response.user.userMetadata["given_name"] == nil, !(given.isEmpty && family.isEmpty) {
            _ = try? await supabase.auth.update(user: UserAttributes(data: [
                "given_name": .string(given),
                "family_name": .string(family),
            ]))
        }
    }

    // MARK: Google

    static func signInWithGoogle() async throws {
        guard let presenter = UIApplication.shared.topViewController else {
            throw AuthFailure("Google konnte nicht geöffnet werden.")
        }
        let nonce = makeNonce()
        let result = try await GIDSignIn.sharedInstance.signIn(
            withPresenting: presenter, hint: nil, additionalScopes: nil, nonce: nonce.hashed
        )
        guard let idToken = result.user.idToken?.tokenString else {
            throw AuthFailure("Google hat kein Token geschickt.")
        }
        try await supabase.auth.signInWithIdToken(credentials: OpenIDConnectCredentials(
            provider: .google,
            idToken: idToken,
            accessToken: result.user.accessToken.tokenString,
            nonce: nonce.raw
        ))
    }

    // MARK: E-Mail

    enum AccountStatus: String {
        case new
        case password
        case noPassword = "no_password"
    }

    static func accountStatus(email: String) async throws -> AccountStatus {
        let value: String = try await supabase
            .rpc("email_account_status", params: ["p_email": email])
            .execute()
            .value
        guard let status = AccountStatus(rawValue: value) else { throw AuthFailure("Unbekannte Antwort.") }
        return status
    }

    /// Neues Konto: Supabase verlangt beim Anlegen ein Passwort, der Nutzer wählt seins aber
    /// erst nach dem Code (Native Redesign 5.1). Darum ein zufälliges, das niemand kennt und
    /// das gleich danach ersetzt wird. Die Mail mit dem Code ist dieselbe wie in der Web-App.
    static func startSignUp(email: String) async throws {
        try await supabase.auth.signUp(email: email, password: randomPassword())
    }

    static func resendCode(email: String) async throws {
        try await supabase.auth.resend(email: email, type: .signup)
    }

    static func verifyCode(email: String, code: String) async throws {
        try await supabase.auth.verifyOTP(email: email, token: code, type: .signup)
    }

    static func setPassword(_ password: String) async throws {
        try await supabase.auth.update(user: UserAttributes(password: password))
    }

    static func signIn(email: String, password: String) async throws {
        try await supabase.auth.signIn(email: email, password: password)
    }

    /// Der Link aus der Mail öffnet sich vorerst in Safari und endet dort (wie heute, Launch Plan).
    static func sendPasswordReset(email: String) async throws {
        try await supabase.auth.resetPasswordForEmail(email, redirectTo: URL(string: "https://www.areuout.de/callback"))
    }

    private static func randomPassword() -> String {
        var bytes = [UInt8](repeating: 0, count: 24)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return "Aa1!" + Data(bytes).base64EncodedString()
    }

    // MARK: Fehlertexte

    /// Supabase-Fehler in einen Satz für den Nutzer.
    static func message(for error: Error) -> String {
        if let failure = error as? AuthFailure { return failure.message }
        if let auth = error as? AuthError {
            switch auth.errorCode {
            case .invalidCredentials: return "E-Mail oder Passwort stimmt nicht."
            case .otpExpired: return "Der Code stimmt nicht oder ist abgelaufen."
            case .overEmailSendRateLimit, .overRequestRateLimit: return "Zu viele Versuche. Warte einen Moment."
            case .weakPassword: return "Dieses Passwort ist zu schwach."
            case .samePassword: return "Nimm ein anderes Passwort als vorher."
            default: return auth.localizedDescription
            }
        }
        if let google = error as? GIDSignInError, google.code == .canceled { return "" }
        if (error as? URLError) != nil { return "Keine Verbindung. Prüf dein Internet." }
        return error.localizedDescription
    }

    static func isEmailNotConfirmed(_ error: Error) -> Bool {
        (error as? AuthError)?.errorCode == .emailNotConfirmed
    }
}

/// Ein Fehler mit fertigem deutschem Text.
struct AuthFailure: Error {
    let message: String
    init(_ message: String) { self.message = message }
}

/// Dieselben Regeln wie die Web-App (features/auth/hooks/usePasswordValidation.ts).
enum PasswordRules {
    static func firstProblem(in password: String) -> String? {
        if password.count < 8 { return "Mindestens 8 Zeichen" }
        if password.range(of: "[A-Z]", options: .regularExpression) == nil { return "Mindestens ein Großbuchstabe" }
        if password.range(of: "[0-9]", options: .regularExpression) == nil { return "Mindestens eine Zahl" }
        if password.range(of: "[^A-Za-z0-9]", options: .regularExpression) == nil { return "Mindestens ein Sonderzeichen" }
        return nil
    }
}

extension UIApplication {
    /// Der oberste View-Controller, für Google, das einen zum Präsentieren braucht.
    var topViewController: UIViewController? {
        let window = connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first(where: \.isKeyWindow)
        var top = window?.rootViewController
        while let presented = top?.presentedViewController { top = presented }
        return top
    }
}
