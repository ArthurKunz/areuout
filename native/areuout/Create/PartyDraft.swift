import CoreLocation
import Foundation
import Observation
import Supabase
import UIKit

/// Alles, was das Formular sammelt (Native Redesign 5.6). Limits wie create_party und
/// draft.ts der Web-App; die Datenbank prüft sie noch einmal.
@Observable
final class PartyDraft: Identifiable {
    enum Limits {
        static let title = 20
        static let motto = 20
        static let dresscode = 20
        static let description = 500
        static let maxGuests = 500
        static let pollQuestion = 60
        static let option = 30
        static let polls = 5
        static let question = 60
        static let questions = 5
        static let organizer = 40
        static let websiteTitle = 40
        static let categoryOther = 20
        static let maxPartyDays = 30
    }

    struct Location: Equatable {
        var label: String
        var lat: Double
        var lng: Double
    }

    struct Poll: Identifiable, Equatable {
        let id = UUID()
        var question = ""
        var options = ["", ""]
        var allowMultiple = false
    }

    // Pflicht
    var picture: UIImage?
    /// Beim Bearbeiten: das bestehende Bild, solange kein neues gewählt ist.
    var currentPictureURL: String?
    var title = ""
    var isPrivate = true
    var start: Date?
    var end: Date?
    var isAllDay = false
    var location: Location?
    var category: String?
    var categoryOther = ""

    // Optional
    var description: String?
    var dresscode: String?
    var motto: String?
    var maxGuests: Int?
    var polls: [Poll] = []
    var questions: [String] = []
    var price: Double?
    var websiteURL: String?
    var websiteTitle: String?
    var organizer: String?

    var hasPicture: Bool { picture != nil || currentPictureURL != nil }

    var titleProblem: String? {
        let trimmed = title.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty { return "Gib deiner Party einen Namen." }
        if trimmed.count > Limits.title { return "Höchstens \(Limits.title) Zeichen." }
        return nil
    }

    var isCategoryComplete: Bool {
        guard let category else { return false }
        if category == "other" {
            let text = categoryOther.trimmingCharacters(in: .whitespaces)
            return !text.isEmpty && text.count <= Limits.categoryOther
        }
        return true
    }

    /// Ohne Bild, Name, Datum, Location und Kategorie bleibt Bestätigen aus (entschieden 2026-11-20).
    var isComplete: Bool {
        hasPicture && titleProblem == nil && start != nil && location != nil && isCategoryComplete && Self.endProblem(start: start, end: end) == nil
    }

    static func endProblem(start: Date?, end: Date?) -> String? {
        guard let start, let end else { return nil }
        if end <= start { return "Das Ende muss nach dem Start liegen." }
        if end.timeIntervalSince(start) > Double(Limits.maxPartyDays) * 86_400 {
            return "Eine Party darf höchstens \(Limits.maxPartyDays) Tage dauern."
        }
        return nil
    }

    /// Wie toWebsiteUrl der Web-App: immer mit https://, ohne Leerzeichen, mit Punkt im Namen.
    static func normalizedWebsite(_ input: String) -> String? {
        var rest = input.trimmingCharacters(in: .whitespacesAndNewlines)
        for prefix in ["https://", "http://"] where rest.lowercased().hasPrefix(prefix) {
            rest = String(rest.dropFirst(prefix.count))
        }
        guard !rest.isEmpty, rest.rangeOfCharacter(from: .whitespaces) == nil else { return nil }
        let url = "https://\(rest)"
        guard url.count <= 500, let host = URL(string: url)?.host() else { return nil }
        let labels = host.split(separator: ".", omittingEmptySubsequences: false)
        return labels.count >= 2 && labels.allSatisfy { !$0.isEmpty } ? url : nil
    }

    /// Umfragen so, wie sie gespeichert werden: getrimmt, leere Zeilen raus.
    var cleanedPolls: [Poll] {
        polls.map { poll in
            var copy = poll
            copy.question = poll.question.trimmingCharacters(in: .whitespaces)
            copy.options = poll.options.map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
            return copy
        }
        .filter { !$0.question.isEmpty || !$0.options.isEmpty }
    }

    var cleanedQuestions: [String] {
        questions.map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
    }

    // MARK: Bearbeiten

    /// Füllt das Formular mit einer bestehenden Party (Edit Party).
    static func from(_ detail: PartyDetail, polls: [PollData]) -> PartyDraft {
        let draft = PartyDraft()
        draft.currentPictureURL = detail.backgroundURL
        draft.title = detail.title
        draft.isPrivate = !detail.isPublic
        draft.start = detail.eventDate
        draft.isAllDay = detail.isAllDay ?? false
        draft.end = (draft.isAllDay ? nil : detail.endsAt)
        if let lat = detail.lat, let lng = detail.lng, let label = detail.location {
            draft.location = Location(label: label, lat: lat, lng: lng)
        }
        draft.category = detail.category
        draft.categoryOther = detail.categoryOther ?? ""
        draft.description = detail.description
        draft.dresscode = detail.dresscode
        draft.motto = detail.motto
        draft.maxGuests = detail.maxGuests
        draft.price = detail.price
        draft.websiteURL = detail.websiteURL
        draft.websiteTitle = detail.websiteTitle
        draft.organizer = detail.organizerName
        draft.polls = polls.filter { !$0.isQuestion }.map { poll in
            Poll(question: poll.question, options: poll.options.map(\.label), allowMultiple: poll.allowMultiple)
        }
        draft.questions = polls.filter(\.isQuestion).map(\.question)
        return draft
    }
}

// MARK: Speichern

enum PartySaver {
    static let bucket = "event-backgrounds"

    /// Ganztägig: Start am Tagesanfang, Ende am Tagesende (Berliner Zeit), dann greift die
    /// 24-Stunden-Regel des Servers wie immer.
    static func times(for draft: PartyDraft) -> (start: Date, end: Date?) {
        guard let start = draft.start else { return (Date(), nil) }
        guard draft.isAllDay else { return (start, draft.end) }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Europe/Berlin")!
        let dayStart = calendar.startOfDay(for: start)
        let lastDay = calendar.startOfDay(for: draft.end ?? start)
        let dayEnd = calendar.date(byAdding: DateComponents(day: 1, second: -1), to: lastDay)!
        return (dayStart, dayEnd)
    }

    /// Neue Party, in der Reihenfolge von saveParty der Web-App: erst das Bild, dann eine
    /// create_party-Transaktion; scheitert sie, fliegt das Bild wieder raus.
    static func create(_ draft: PartyDraft, userID: UUID) async throws -> UUID {
        let partyID = UUID()
        guard let picture = draft.picture else { throw AuthFailure("Wähl ein Bild für deine Party.") }
        let path = folder(userID: userID, partyID: partyID) + "/background-\(Int(Date().timeIntervalSince1970 * 1000)).jpg"
        let url = try await upload(picture, path: path)
        do {
            try await supabase.rpc("create_party", params: PartyParams(draft: draft, partyID: partyID, backgroundURL: url, inviteCode: makeInviteCode(), isUpdate: false)).execute()
        } catch {
            try? await AvatarStorage.removeFolder(bucket: bucket, prefix: folder(userID: userID, partyID: partyID))
            throw error
        }
        return partyID
    }

    /// Party ändern, wie saveEdit der Web-App: neues Bild unter neuem Namen, dann
    /// update_party, danach das alte eigene Bild löschen.
    static func update(_ draft: PartyDraft, partyID: UUID, userID: UUID) async throws {
        var backgroundURL = draft.currentPictureURL ?? ""
        var uploaded: String?
        if let picture = draft.picture {
            let path = folder(userID: userID, partyID: partyID) + "/background-\(Int(Date().timeIntervalSince1970 * 1000)).jpg"
            backgroundURL = try await upload(picture, path: path)
            uploaded = backgroundURL
        }
        do {
            try await supabase.rpc("update_party", params: PartyParams(draft: draft, partyID: partyID, backgroundURL: backgroundURL, inviteCode: nil, isUpdate: true)).execute()
        } catch {
            if let uploaded { await removeFile(publicURL: uploaded) }
            throw error
        }
        if uploaded != nil, let old = draft.currentPictureURL { await removeFile(publicURL: old) }
    }

    private static func folder(userID: UUID, partyID: UUID) -> String {
        "\(userID.uuidString.lowercased())/\(partyID.uuidString.lowercased())"
    }

    /// Nie das gewählte Original: neu gezeichnet (ohne Standort), höchstens 1600 px wie BACKGROUND_MAX_EDGE.
    private static func upload(_ image: UIImage, path: String) async throws -> String {
        guard let jpeg = image.avatarJPEG(maxEdge: 1600) else {
            throw AuthFailure("Dein Bild konnte nicht verarbeitet werden. Versuch es mit einem anderen.")
        }
        let files = supabase.storage.from(bucket)
        try await files.upload(path, data: jpeg, options: FileOptions(cacheControl: "3600", contentType: "image/jpeg", upsert: false))
        return try files.getPublicURL(path: path).absoluteString
    }

    /// Nur Dateien in diesem Bucket; Vorlagen (/backgrounds/…) bleiben.
    private static func removeFile(publicURL: String) async {
        guard let path = publicURL.components(separatedBy: "/\(bucket)/").dropFirst().first, !path.isEmpty else { return }
        _ = try? await supabase.storage.from(bucket).remove(paths: [path])
    }

    private static func makeInviteCode() -> String {
        let alphabet = Array("0123456789abcdefghjkmnpqrstvwxyz")
        var bytes = [UInt8](repeating: 0, count: 12)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return String(bytes.map { alphabet[Int($0) % alphabet.count] })
    }
}

/// Die Parameter von create_party und update_party. Alle werden gesendet, auch leere als
/// JSON-null, weil die Funktionen sie positionsgenau erwarten.
private nonisolated struct PartyParams: Encodable {
    struct PollJSON: Encodable {
        let question: String
        let options: [String]
        let allow_multiple: Bool
    }

    let id: UUID
    let title: String
    let isPublic: Bool
    let eventDate: Date
    let endsAt: Date?
    let location: String
    let lat: Double
    let lng: Double
    let backgroundURL: String
    let inviteCode: String?
    let description: String?
    let motto: String?
    let dresscode: String?
    let maxGuests: Int?
    let polls: [PollJSON]
    let questions: [String]
    let price: Double?
    let websiteURL: String?
    let organizer: String?
    let category: String
    let categoryOther: String?
    let isAllDay: Bool
    let websiteTitle: String?
    let isUpdate: Bool

    @MainActor
    init(draft: PartyDraft, partyID: UUID, backgroundURL: String, inviteCode: String?, isUpdate: Bool) {
        let times = PartySaver.times(for: draft)
        func clean(_ text: String?) -> String? {
            let trimmed = text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            return trimmed.isEmpty ? nil : trimmed
        }
        id = partyID
        title = draft.title.trimmingCharacters(in: .whitespaces)
        isPublic = !draft.isPrivate
        eventDate = times.start
        endsAt = times.end
        location = draft.location?.label ?? ""
        lat = draft.location?.lat ?? 0
        lng = draft.location?.lng ?? 0
        self.backgroundURL = backgroundURL
        self.inviteCode = inviteCode
        description = clean(draft.description)
        motto = clean(draft.motto)
        dresscode = clean(draft.dresscode)
        maxGuests = draft.maxGuests
        polls = draft.cleanedPolls.map { PollJSON(question: $0.question, options: $0.options, allow_multiple: $0.allowMultiple) }
        questions = draft.cleanedQuestions
        price = draft.price
        // Beim Ändern heißt '' "entfernen", NULL hieße "so lassen" (update_party).
        websiteURL = isUpdate ? (clean(draft.websiteURL) ?? "") : clean(draft.websiteURL)
        organizer = isUpdate ? (clean(draft.organizer) ?? "") : clean(draft.organizer)
        category = draft.category ?? "other"
        categoryOther = draft.category == "other" ? clean(draft.categoryOther) : nil
        isAllDay = draft.isAllDay
        websiteTitle = isUpdate ? (clean(draft.websiteTitle) ?? "") : clean(draft.websiteTitle)
        self.isUpdate = isUpdate
    }

    enum CodingKeys: String, CodingKey {
        case id = "p_id"
        case title = "p_title"
        case isPublic = "p_is_public"
        case eventDate = "p_event_date"
        case endsAt = "p_ends_at"
        case location = "p_location"
        case lat = "p_lat"
        case lng = "p_lng"
        case backgroundURL = "p_background_url"
        case inviteCode = "p_invite_code"
        case description = "p_description"
        case motto = "p_motto"
        case dresscode = "p_dresscode"
        case maxGuests = "p_max_guests"
        case polls = "p_polls"
        case questions = "p_questions"
        case price = "p_price"
        case websiteURL = "p_website_url"
        case organizer = "p_organizer_name"
        case category = "p_category"
        case categoryOther = "p_category_other"
        case isAllDay = "p_is_all_day"
        case websiteTitle = "p_website_title"
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        let iso = ISO8601DateFormatter()
        try c.encode(id, forKey: .id)
        try c.encode(title, forKey: .title)
        try c.encode(isPublic, forKey: .isPublic)
        try c.encode(iso.string(from: eventDate), forKey: .eventDate)
        try c.encode(endsAt.map { iso.string(from: $0) }, forKey: .endsAt)
        try c.encode(location, forKey: .location)
        try c.encode(lat, forKey: .lat)
        try c.encode(lng, forKey: .lng)
        try c.encode(backgroundURL, forKey: .backgroundURL)
        if !isUpdate { try c.encode(inviteCode, forKey: .inviteCode) }
        try c.encode(description, forKey: .description)
        try c.encode(motto, forKey: .motto)
        try c.encode(dresscode, forKey: .dresscode)
        try c.encode(maxGuests, forKey: .maxGuests)
        try c.encode(polls, forKey: .polls)
        try c.encode(questions, forKey: .questions)
        try c.encode(price, forKey: .price)
        try c.encode(websiteURL, forKey: .websiteURL)
        try c.encode(organizer, forKey: .organizer)
        try c.encode(category, forKey: .category)
        try c.encode(categoryOther, forKey: .categoryOther)
        try c.encode(isAllDay, forKey: .isAllDay)
        try c.encode(websiteTitle, forKey: .websiteTitle)
    }
}
