import Foundation
import Observation
import Supabase
import UIKit

/// Das eigene Profil, geladen einmal nach dem Login. Profil- und Parties-Tab lesen daraus.
@Observable
final class ProfileStore {
    struct Profile: Decodable {
        var firstname: String?
        var lastname: String?
        var avatarURL: String?
        var avatarColor: String

        enum CodingKeys: String, CodingKey {
            case firstname, lastname
            case avatarURL = "avatar_url"
            case avatarColor = "avatar_color"
        }
    }

    private(set) var profile: Profile?
    private(set) var userID: UUID?
    /// Konten nur über Apple oder Google haben kein Passwort; ihre Zeile `Password` fehlt.
    private(set) var hasPassword = false
    private(set) var usesApple = false

    var fullName: String {
        [profile?.firstname, profile?.lastname].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " ")
    }

    var initials: String { FullName.initials(first: profile?.firstname, last: profile?.lastname) }

    func load() async {
        guard let user = try? await supabase.auth.session.user else { return }
        userID = user.id
        let providers = Set(user.identities?.map(\.provider) ?? [])
        hasPassword = providers.contains("email")
        usesApple = providers.contains("apple")
        profile = try? await supabase
            .from("profiles")
            .select("firstname, lastname, avatar_url, avatar_color")
            .eq("id", value: user.id)
            .single()
            .execute()
            .value
    }

    func updateName(_ text: String) async throws {
        guard let userID else { return }
        let parts = FullName.split(text)
        try await supabase
            .from("profiles")
            .update(["firstname": parts.first, "lastname": parts.last])
            .eq("id", value: userID)
            .execute()
        profile?.firstname = parts.first
        profile?.lastname = parts.last
    }

    /// Erst hochladen und die Zeile umstellen, dann die alte Datei löschen (wie uploadAvatar
    /// der Web-App), damit das Profil nie auf eine fehlende Datei zeigt.
    func updatePicture(_ image: UIImage) async throws {
        guard let userID else { return }
        let previous = profile?.avatarURL
        let url = try await AvatarStorage.upload(image, userID: userID)
        try await supabase
            .from("profiles")
            .update(["avatar_url": url])
            .eq("id", value: userID)
            .execute()
        profile?.avatarURL = url
        await AvatarStorage.remove(publicURL: previous)
    }

    func clear() {
        profile = nil
        userID = nil
        hasPassword = false
        usesApple = false
    }
}
