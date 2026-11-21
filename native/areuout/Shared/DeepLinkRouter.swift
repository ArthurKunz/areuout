import Foundation
import Observation
import Supabase

/// Universal Links von www.areuout.de (Native Redesign 6):
/// - `/e/<code>` Host-Link: gibt Zugang, auch zu einer privaten Party.
/// - `/p/<party>` Gast-Link: öffnet nur die Party; privat heißt dann anfragen.
/// Kommt der Link ohne Login, wartet er hier, bis die App eingeloggt ist.
@Observable
final class DeepLinkRouter {
    enum Target: Equatable {
        case party(UUID)
        case invite(String)
    }

    var pending: Target?

    /// true, wenn der Link zu areuout gehört (sonst ist er z. B. für Google).
    func handle(_ url: URL) -> Bool {
        guard let host = url.host(), host == "www.areuout.de" || host == "areuout.de" else { return false }
        let parts = url.pathComponents.filter { $0 != "/" }
        guard parts.count >= 2 else { return true }
        switch parts[0] {
        case "e": pending = .invite(parts[1])
        case "p": if let id = UUID(uuidString: parts[1]) { pending = .party(id) }
        default: break
        }
        return true
    }

    /// Host-Link auflösen. get_party_by_invite_code merkt sich dabei, dass dieser Nutzer
    /// den Link geöffnet hat; das gibt ihm den Zugang (private.invite_opens).
    static func resolveInvite(_ code: String) async -> UUID? {
        let rows: [InviteRow]? = try? await supabase
            .rpc("get_party_by_invite_code", params: ["p_invite_code": code])
            .execute()
            .value
        return rows?.first?.id
    }

    /// Der Link, den jemand teilt: der Host seinen Einladungslink, alle anderen den Gast-Link
    /// ohne Code, damit niemand den Zugang des Hosts weitergibt.
    static func guestURL(for partyID: UUID) -> URL {
        AppConfig.websiteURL.appending(path: "p/\(partyID.uuidString.lowercased())")
    }
}

private nonisolated struct InviteRow: Decodable {
    let id: UUID
}
