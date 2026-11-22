import AuthenticationServices
import UIKit

/// Fragt Apple nach einer Anmeldung, ohne Apples fertigen Knopf: für den eigenen Knopf auf der
/// Startseite (gleiche Schrift wie Google) und für die Bestätigung beim Löschen des Kontos.
final class AppleAuthorization: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    private var continuation: CheckedContinuation<ASAuthorizationAppleIDCredential, Error>?

    static func request(scopes: [ASAuthorization.Scope], nonceHashed: String) async throws -> ASAuthorizationAppleIDCredential {
        try await AppleAuthorization().run(scopes: scopes, nonceHashed: nonceHashed)
    }

    private func run(scopes: [ASAuthorization.Scope], nonceHashed: String) async throws -> ASAuthorizationAppleIDCredential {
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = scopes
        request.nonce = nonceHashed
        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        return try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            controller.performRequests()
        }
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        if let credential = authorization.credential as? ASAuthorizationAppleIDCredential {
            continuation?.resume(returning: credential)
        } else {
            continuation?.resume(throwing: AuthFailure("Apple hat nicht geantwortet."))
        }
        continuation = nil
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        continuation?.resume(throwing: error)
        continuation = nil
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        if let window = UIApplication.shared.topViewController?.view.window { return window }
        let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first!
        return ASPresentationAnchor(windowScene: scene)
    }
}
