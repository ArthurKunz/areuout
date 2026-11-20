import Foundation
import Observation
import Supabase

/// Wo der Nutzer gerade steht. Die App zeigt danach Start, Onboarding oder die App selbst.
@Observable
final class AuthModel {
    enum Phase: Equatable {
        case loading
        case signedOut
        case onboarding
        case signedIn
        case failed(String)
    }

    private(set) var phase: Phase = .loading
    /// Name aus Apple oder Google, als Vorschlag im Onboarding.
    private(set) var suggestedName = ""

    /// Während der E-Mail-Registrierung: nach dem Code ist der Nutzer schon eingeloggt, muss
    /// aber erst sein Passwort setzen. Solange bleibt die Phase stehen.
    var isSettingPassword = false

    func start() async {
        for await (_, session) in supabase.auth.authStateChanges {
            await update(for: session)
        }
    }

    /// Nach dem Passwort oder dem Onboarding: Phase neu bestimmen.
    func refresh() async {
        await update(for: try? await supabase.auth.session)
    }

    func signOut() async {
        isSettingPassword = false
        try? await supabase.auth.signOut()
        phase = .signedOut
    }

    private func update(for session: Session?) async {
        guard !isSettingPassword else { return }
        guard let session else {
            phase = .signedOut
            return
        }
        do {
            let rows: [ProfileID] = try await supabase
                .from("profiles")
                .select("id")
                .eq("id", value: session.user.id)
                .execute()
                .value
            if rows.isEmpty {
                suggestedName = Self.name(from: session.user)
                phase = .onboarding
            } else {
                phase = .signedIn
            }
        } catch {
            phase = .failed("Dein Profil konnte nicht geladen werden. Prüf deine Verbindung.")
        }
    }

    /// Apple legt Vor- und Nachname in given_name/family_name ab (siehe AuthService),
    /// Google den ganzen Namen in full_name oder name.
    private static func name(from user: User) -> String {
        let meta = user.userMetadata
        let given = meta["given_name"]?.stringValue ?? ""
        let family = meta["family_name"]?.stringValue ?? ""
        let combined = "\(given) \(family)".trimmingCharacters(in: .whitespaces)
        if !combined.isEmpty { return combined }
        return meta["full_name"]?.stringValue ?? meta["name"]?.stringValue ?? ""
    }
}

nonisolated private struct ProfileID: Decodable {
    let id: UUID
}
