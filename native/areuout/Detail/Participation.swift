import Foundation
import Supabase

// Daten und Aufrufe für Antworten, Anfragen, Gästeliste, Umfragen und Fragen.
// Dieselben Tabellen und Funktionen wie die Web-App (features/parties/services,
// features/party-detail). Wer was sehen und tun darf, entscheidet der Server.

nonisolated struct PollData: Decodable, Identifiable {
    struct Option: Decodable, Identifiable {
        let optionID: UUID
        let label: String
        var id: UUID { optionID }

        enum CodingKeys: String, CodingKey {
            case optionID = "option_id"
            case label
        }
    }

    struct Response: Decodable {
        let optionID: UUID?
        let userID: UUID
        let firstname: String?
        let lastname: String?
        let avatarURL: String?
        let avatarColor: String?
        let textResponse: String?

        enum CodingKeys: String, CodingKey {
            case optionID = "option_id"
            case userID = "user_id"
            case firstname, lastname
            case avatarURL = "avatar_url"
            case avatarColor = "avatar_color"
            case textResponse = "text_response"
        }

        var name: String { [firstname, lastname].compactMap { $0 }.joined(separator: " ") }
    }

    let poolID: UUID
    let question: String
    let allowMultiple: Bool
    /// `options` (Umfrage) oder `text_only` (Frage).
    let type: String
    let options: [Option]
    let responses: [Response]

    var id: UUID { poolID }
    var isQuestion: Bool { type == "text_only" }

    enum CodingKeys: String, CodingKey {
        case poolID = "pool_id"
        case question
        case allowMultiple = "allow_multiple"
        case type, options, responses
    }

    func votes(for option: UUID) -> [Response] { responses.filter { $0.optionID == option } }
    func myOptions(_ userID: UUID?) -> Set<UUID> {
        Set(responses.filter { $0.userID == userID }.compactMap(\.optionID))
    }
}

nonisolated struct GuestRow: Decodable, Identifiable {
    let userID: UUID
    let firstname: String?
    let lastname: String?
    let avatarURL: String?
    let avatarColor: String?
    let status: String

    var id: UUID { userID }
    var name: String { [firstname, lastname].compactMap { $0 }.joined(separator: " ") }

    enum CodingKeys: String, CodingKey {
        case userID = "user_id"
        case firstname, lastname, status
        case avatarURL = "avatar_url"
        case avatarColor = "avatar_color"
    }
}

nonisolated struct JoinRequestRow: Decodable, Identifiable {
    let userID: UUID
    let firstname: String?
    let lastname: String?
    let avatarURL: String?
    let avatarColor: String?

    var id: UUID { userID }
    var name: String { [firstname, lastname].compactMap { $0 }.joined(separator: " ") }

    enum CodingKeys: String, CodingKey {
        case userID = "user_id"
        case firstname, lastname
        case avatarURL = "avatar_url"
        case avatarColor = "avatar_color"
    }
}

/// Die drei Antworten, wie rsvps.status sie speichert.
enum RSVPStatus: String, CaseIterable, Identifiable {
    case going, maybe, notGoing = "not_going"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .going: "zugesagt"
        case .maybe: "vielleicht"
        case .notGoing: "abgesagt"
        }
    }

    var icon: String {
        switch self {
        case .going: "checkmark"
        case .maybe: "questionmark"
        case .notGoing: "xmark"
        }
    }
}

enum Participation {
    private nonisolated struct RSVPRow: Encodable {
        let eventID: UUID
        let userID: UUID
        let status: String

        enum CodingKeys: String, CodingKey {
            case eventID = "event_id"
            case userID = "user_id"
            case status
        }
    }

    private nonisolated struct SingleResponseParams: Encodable {
        let poolID: UUID
        let optionID: UUID?
        let text: String?

        enum CodingKeys: String, CodingKey {
            case poolID = "p_pool_id"
            case optionID = "p_option_id"
            case text = "p_text_response"
        }

        // Beide Argumente dürfen null sein und müssen dann als JSON-null mitgehen.
        func encode(to encoder: Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)
            try container.encode(poolID, forKey: .poolID)
            try container.encode(optionID, forKey: .optionID)
            try container.encode(text, forKey: .text)
        }
    }

    private nonisolated struct NewResponse: Encodable {
        let poolID: UUID
        let userID: UUID
        let optionID: UUID

        enum CodingKeys: String, CodingKey {
            case poolID = "pool_id"
            case userID = "user_id"
            case optionID = "option_id"
        }
    }

    /// Antwort setzen oder ändern (upsert wie setRsvp der Web-App).
    static func setStatus(_ status: RSVPStatus, party: UUID, user: UUID) async throws {
        try await supabase
            .from("rsvps")
            .upsert(RSVPRow(eventID: party, userID: user, status: status.rawValue), onConflict: "event_id,user_id")
            .execute()
    }

    static func requestToJoin(party: UUID) async throws {
        try await supabase.rpc("request_to_join", params: ["p_event_id": party]).execute()
    }

    static func hasRoom(party: UUID, user: UUID) async -> Bool {
        let room: Bool? = try? await supabase
            .rpc("party_has_room", params: ["p_event_id": party, "p_user_id": user])
            .execute()
            .value
        return room ?? true
    }

    static func accept(_ requester: UUID, party: UUID) async throws {
        try await supabase.rpc("accept_join_request", params: ["p_event_id": party, "p_user_id": requester]).execute()
    }

    static func decline(_ requester: UUID, party: UUID) async throws {
        try await supabase.rpc("decline_join_request", params: ["p_event_id": party, "p_user_id": requester]).execute()
    }

    /// Host: einen Gast entfernen (rsvps_delete_host).
    static func removeGuest(_ guest: UUID, party: UUID) async throws {
        try await supabase.from("rsvps").delete().eq("event_id", value: party).eq("user_id", value: guest).execute()
    }

    static func polls(party: UUID) async throws -> [PollData] {
        try await supabase.rpc("get_party_poll_data", params: ["p_event_id": party]).execute().value
    }

    static func guestList(party: UUID) async throws -> [GuestRow] {
        try await supabase.rpc("get_party_guest_list", params: ["p_event_id": party]).execute().value
    }

    static func requests(party: UUID) async throws -> [JoinRequestRow] {
        try await supabase.rpc("get_party_join_requests", params: ["p_event_id": party]).execute().value
    }

    /// Umfrage: bei einer Antwort ersetzt die neue Wahl die alte (in einer Transaktion,
    /// set_single_pool_response), bei mehreren schaltet jede Option einzeln.
    static func vote(_ option: UUID, in poll: PollData, user: UUID) async throws {
        if poll.allowMultiple {
            if poll.myOptions(user).contains(option) {
                try await supabase.from("pool_responses").delete()
                    .eq("pool_id", value: poll.poolID).eq("user_id", value: user).eq("option_id", value: option)
                    .execute()
            } else {
                try await supabase.from("pool_responses")
                    .insert(NewResponse(poolID: poll.poolID, userID: user, optionID: option))
                    .execute()
            }
        } else {
            try await supabase.rpc("set_single_pool_response", params: SingleResponseParams(poolID: poll.poolID, optionID: option, text: nil)).execute()
        }
    }

    /// Frage: die eigene Antwort (höchstens 25 Zeichen, pool_responses_text_max_25).
    static func answer(_ text: String, to question: PollData) async throws {
        try await supabase.rpc("set_single_pool_response", params: SingleResponseParams(poolID: question.poolID, optionID: nil, text: text)).execute()
    }

    /// Satz für den Nutzer, wenn eine Antwort scheitert (wie rsvpErrorText der Web-App).
    static func rsvpErrorText(_ error: Error) -> String {
        if let postgrest = error as? PostgrestError, postgrest.code == "42501" {
            return "Auf diese Party kannst du gerade nicht antworten."
        }
        return "Deine Antwort konnte nicht gespeichert werden."
    }
}
