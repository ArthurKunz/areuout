import Foundation
import Observation
import Supabase

/// Eine Party aus get_party_detail. Ohne Zugang zu einer privaten Party sind location,
/// website_url und website_title schon auf dem Server leer (is_exact = false).
nonisolated struct PartyDetail: Decodable {
    let id: UUID
    let hostID: UUID
    let hostFirstname: String?
    let hostLastname: String?
    let hostAvatarURL: String?
    let hostAvatarColor: String?
    let title: String
    let description: String?
    let motto: String?
    let dresscode: String?
    let eventDate: Date
    let endsAt: Date?
    let backgroundURL: String?
    let maxGuests: Int?
    let price: Double?
    let isPublic: Bool
    let lat: Double?
    let lng: Double?
    let isExact: Bool
    let location: String?
    let myStatus: String?
    let websiteURL: String?
    let organizerName: String?
    let category: String?
    let categoryOther: String?
    let isAllDay: Bool?
    let websiteTitle: String?

    enum CodingKeys: String, CodingKey {
        case id, title, description, motto, dresscode, price, lat, lng, location, category
        case hostID = "host_id"
        case hostFirstname = "host_firstname"
        case hostLastname = "host_lastname"
        case hostAvatarURL = "host_avatar_url"
        case hostAvatarColor = "host_avatar_color"
        case eventDate = "event_date"
        case endsAt = "ends_at"
        case backgroundURL = "background_url"
        case maxGuests = "max_guests"
        case isPublic = "is_public"
        case isExact = "is_exact"
        case myStatus = "my_status"
        case websiteURL = "website_url"
        case organizerName = "organizer_name"
        case categoryOther = "category_other"
        case isAllDay = "is_all_day"
        case websiteTitle = "website_title"
    }

    var hostName: String {
        [hostFirstname, hostLastname].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " ")
    }

    var imageURL: URL? {
        guard let backgroundURL else { return nil }
        if backgroundURL.hasPrefix("/") {
            return AppConfig.websiteURL.appending(path: String(backgroundURL.dropFirst()))
        }
        return URL(string: backgroundURL)
    }

    /// Hat der Nutzer eine Antwort (auch abgesagt)? Dann ist er Gast.
    var hasAnswer: Bool {
        ["going", "maybe", "not_going"].contains(myStatus ?? "")
    }
}

/// Nur für Partys des Agents (get_agent_event_details antwortet sonst leer).
nonisolated struct AgentInfo: Decodable {
    let organizerName: String?
    let cancelledAt: Date?
    let goingCount: Int?

    enum CodingKeys: String, CodingKey {
        case organizerName = "organizer_name"
        case cancelledAt = "cancelled_at"
        case goingCount = "going_count"
    }
}

nonisolated struct RSVPCounts: Decodable {
    let goingCount: Int
    let maybeCount: Int
    let notGoingCount: Int

    enum CodingKeys: String, CodingKey {
        case goingCount = "going_count"
        case maybeCount = "maybe_count"
        case notGoingCount = "not_going_count"
    }
}

/// Lädt eine Party und führt die Aktionen aus dem ⋯-Menü aus (wie die Web-App).
@Observable
final class PartyDetailModel {
    enum Role {
        case host, guest, stranger
    }

    enum ReportReason: String, CaseIterable {
        case organizer, spam, harassment, inappropriate, other

        var label: String {
            switch self {
            case .organizer: "Ich bin der Veranstalter"
            case .spam: "Spam"
            case .harassment: "Belästigung"
            case .inappropriate: "Unangemessene Inhalte"
            case .other: "Etwas anderes"
            }
        }
    }

    let partyID: UUID
    private(set) var detail: PartyDetail?
    private(set) var agent: AgentInfo?
    private(set) var counts: RSVPCounts?
    private(set) var inviteCode: String?
    private(set) var loadFailed = false

    init(partyID: UUID) {
        self.partyID = partyID
    }

    #if DEBUG
    /// Nur zum Ansehen im Simulator ohne Login (Startargument -uiPreviewDetail).
    static func sample() -> PartyDetailModel {
        let json = """
        {"id":"00000000-0000-4000-8000-000000000001","host_id":"00000000-0000-4000-8000-000000000002",
         "host_firstname":"Arthur","host_lastname":"Kunz","host_avatar_url":null,"host_avatar_color":"#1E5CFF",
         "title":"Hausparty","description":"Ich feier meinen 18. Geburtstag. Wir feiern im Hinterhof.",
         "motto":"Halloween","dresscode":"gruselig","event_date":"2026-11-26T10:00:00+00:00",
         "ends_at":null,"background_url":"/backgrounds/bg-1.jpg","max_guests":50,"price":5.5,"is_public":false,
         "lat":51.33,"lng":12.38,"is_exact":true,"location":"Bretschneiderstraße 14","my_status":"going",
         "website_url":"https://example.com","organizer_name":null,"category":"house","category_other":null,
         "is_all_day":false,"website_title":"Tickets"}
        """
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let model = PartyDetailModel(partyID: UUID())
        model.detail = try? decoder.decode(PartyDetail.self, from: Data(json.utf8))
        model.counts = RSVPCounts(goingCount: 12, maybeCount: 3, notGoingCount: 1)
        return model
    }
    #endif

    func role(for userID: UUID?) -> Role {
        guard let detail else { return .stranger }
        if detail.hostID == userID { return .host }
        return detail.hasAnswer ? .guest : .stranger
    }

    var isAgentEvent: Bool { agent != nil }

    var inviteURL: URL? {
        inviteCode.map { AppConfig.websiteURL.appending(path: "e/\($0)") }
    }

    func load(userID: UUID?) async {
        do {
            let detail: PartyDetail = try await supabase
                .rpc("get_party_detail", params: ["p_event_id": partyID])
                .single()
                .execute()
                .value
            self.detail = detail
            loadFailed = false
        } catch {
            loadFailed = true
            return
        }
        // Die Nebeninfos dürfen fehlen, ohne dass die Party nicht angezeigt wird.
        agent = try? await supabase.rpc("get_agent_event_details", params: ["p_event_id": partyID]).single().execute().value
        counts = try? await supabase.rpc("get_rsvp_counts_by_status", params: ["p_event_id": partyID]).single().execute().value
        if role(for: userID) == .host {
            inviteCode = try? await supabase.rpc("get_party_invite_code", params: ["p_event_id": partyID]).execute().value
        }
    }

    /// Host: Party löschen, danach das Bild (liegt unter {host}/{party}/, wie deleteParty der Web-App).
    func deleteParty() async throws {
        guard let detail else { return }
        try await supabase.from("events").delete().eq("id", value: partyID).execute()
        try? await AvatarStorage.removeFolder(
            bucket: "event-backgrounds",
            prefix: "\(detail.hostID.uuidString.lowercased())/\(partyID.uuidString.lowercased())"
        )
    }

    /// Gast: die eigene Antwort löschen. Die Party bleibt, verschwindet aber aus `Going`.
    /// Bei einer privaten Party geht damit auch der Zugang (Native Redesign 5.5).
    func removeMyAnswer(userID: UUID) async throws {
        try await supabase.from("rsvps").delete().eq("event_id", value: partyID).eq("user_id", value: userID).execute()
    }

    /// Host: neuer Einladungscode, der alte Link ist sofort tot (Link-Reset bei geleaktem Invite).
    func resetInviteLink() async throws {
        let code = Self.makeInviteCode()
        try await supabase.from("events").update(["invite_code": code]).eq("id", value: partyID).execute()
        inviteCode = code
    }

    func report(_ reason: ReportReason) async throws {
        guard let detail else { return }
        try await supabase.rpc("submit_report", params: ReportParams(
            pKind: "party",
            pReportedUserID: detail.hostID,
            pEventID: partyID,
            pReason: reason.rawValue
        )).execute()
    }

    /// Wie generateInviteCode in lib/utils.ts: 12 Zeichen aus Crockfords Base32.
    private static func makeInviteCode() -> String {
        let alphabet = Array("0123456789abcdefghjkmnpqrstvwxyz")
        var bytes = [UInt8](repeating: 0, count: 12)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return String(bytes.map { alphabet[Int($0) % alphabet.count] })
    }
}

nonisolated private struct ReportParams: Encodable {
    let pKind: String
    let pReportedUserID: UUID
    let pEventID: UUID
    let pAnswerText: String? = nil
    let pReason: String

    enum CodingKeys: String, CodingKey {
        case pKind = "p_kind"
        case pReportedUserID = "p_reported_user_id"
        case pEventID = "p_event_id"
        case pAnswerText = "p_answer_text"
        case pReason = "p_reason"
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(pKind, forKey: .pKind)
        try container.encode(pReportedUserID, forKey: .pReportedUserID)
        try container.encode(pEventID, forKey: .pEventID)
        try container.encodeNil(forKey: .pAnswerText)
        try container.encode(pReason, forKey: .pReason)
    }
}
