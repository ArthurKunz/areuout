import Supabase
import SwiftUI

/// Admin-Bereich `Neue Events` ([[Party Agent]] Schritt 4–6, wie AgentReviewScreen der Web-App):
/// Meldungen von Veranstaltern, Änderungs- und Absage-Vorschläge, dann die neuen Entwürfe.
/// Alle Funktionen prüfen selbst private.is_admin(); die Zeile im Profil sieht nur ein Admin.
struct AdminView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @Environment(PartyFeed.self) private var feed

    @State private var drafts: [AgentDraft] = []
    @State private var proposals: [AgentProposal] = []
    @State private var reports: [AgentReport] = []
    @State private var isLoading = true
    @State private var loadFailed = false
    @State private var errorMessage: String?
    @State private var removing: AgentReport?
    @State private var cancelling: AgentProposal?

    var body: some View {
        NavigationStack {
            List {
                if isLoading && drafts.isEmpty && proposals.isEmpty && reports.isEmpty {
                    ProgressView().frame(maxWidth: .infinity).listRowBackground(Color.clear)
                } else if loadFailed {
                    ContentUnavailableView {
                        Label("Nicht geladen", systemImage: "wifi.exclamationmark")
                    } description: {
                        Text("Die Entwürfe konnten nicht geladen werden.")
                    } actions: {
                        Button("Nochmal versuchen") { Task { await load() } }
                    }
                    .listRowBackground(Color.clear)
                } else if drafts.isEmpty && proposals.isEmpty && reports.isEmpty {
                    ContentUnavailableView(
                        "Alles erledigt",
                        systemImage: "checkmark.circle",
                        description: Text("Am \(Self.nextRunDay()) sucht der Agent wieder")
                    )
                    .listRowBackground(Color.clear)
                }
                ForEach(reports) { report in
                    Section {
                        card(title: report.title, subtitle: AdminFormat.dateTime(report.eventDate), source: report.sourceURL) {
                            Label(report.reportCount == 1 ? "Veranstalter-Meldung" : "\(report.reportCount) Meldungen", systemImage: "flag.fill")
                                .font(.subheadline)
                                .foregroundStyle(Color.iconMotto)
                        }
                        buttons(left: ("Behalten", { Task { await keep(report) } }), right: ("Entfernen", { removing = report }), rightIsDestructive: true)
                    }
                }
                ForEach(proposals) { proposal in
                    Section {
                        card(title: proposal.title, subtitle: AdminFormat.dateTime(proposal.eventDate), source: proposal.sourceURL) {
                            if proposal.kind == "cancel" {
                                Label("Abgesagt", systemImage: "calendar.badge.minus")
                                    .font(.subheadline)
                                    .foregroundStyle(Color.appDestructive)
                            } else {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Geändert: \(proposal.changedWhat.joined(separator: ", "))").font(.subheadline.weight(.semibold))
                                    ForEach(proposal.changeLines, id: \.self) { Text($0).font(.subheadline) }
                                }
                                .foregroundStyle(Color(.label))
                            }
                        }
                        if proposal.kind == "cancel" {
                            buttons(left: ("Verwerfen", { Task { await discard(proposal.id) } }), right: ("Als abgesagt markieren", { cancelling = proposal }), rightIsDestructive: true)
                        } else {
                            buttons(left: ("Verwerfen", { Task { await discard(proposal.id) } }), right: ("Freigeben", { Task { await approveProposal(proposal.id) } }))
                        }
                    }
                }
                ForEach(drafts) { draft in
                    Section {
                        VStack(alignment: .leading, spacing: 8) {
                            AsyncImage(url: URL(string: draft.backgroundURL)) { $0.resizable().scaledToFill() } placeholder: { Color.appPlaceholder }
                                .frame(height: 170)
                                .frame(maxWidth: .infinity)
                                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                            card(title: draft.title, subtitle: draft.summary, source: draft.sourceURL) {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(draft.location).font(.subheadline).foregroundStyle(Color(.secondaryLabel))
                                    if let organizer = draft.organizerName {
                                        Text("Veranstalter: \(organizer)").font(.subheadline).foregroundStyle(Color(.secondaryLabel))
                                    }
                                    if let duplicate = draft.duplicateTitle {
                                        Label("Vielleicht schon vorhanden: \(duplicate)", systemImage: "doc.on.doc")
                                            .font(.subheadline)
                                            .foregroundStyle(Color.iconMotto)
                                    }
                                    Text(draft.description).font(.subheadline).foregroundStyle(Color(.label))
                                }
                            }
                        }
                        buttons(left: ("Verwerfen", { Task { await discard(draft.id) } }), right: ("Freigeben", { Task { await approve(draft.id) } }))
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.appBackground)
            .refreshable { await load() }
            .navigationTitle("Neue Events")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button(role: .close) { dismiss() } }
            }
        }
        .task { await load() }
        .confirmationDialog(removing.map { "\($0.title) entfernen?" } ?? "", isPresented: Binding(get: { removing != nil }, set: { if !$0 { removing = nil } }), titleVisibility: .visible) {
            Button("Entfernen", role: .destructive) {
                if let report = removing { Task { await remove(report) } }
            }
            Button("Abbrechen", role: .cancel) {}
        } message: {
            Text("Das Event verschwindet für alle, und der Agent nimmt diese Quelle nicht wieder auf.")
        }
        .confirmationDialog(cancelling.map { "\($0.title) absagen?" } ?? "", isPresented: Binding(get: { cancelling != nil }, set: { if !$0 { cancelling = nil } }), titleVisibility: .visible) {
            Button("Als abgesagt markieren", role: .destructive) {
                if let proposal = cancelling { Task { await approveProposal(proposal.id) } }
            }
            Button("Abbrechen", role: .cancel) {}
        } message: {
            Text("Das Event zeigt dann Abgesagt, niemand kann mehr zusagen, und alle Gäste bekommen eine Push. Das lässt sich nicht rückgängig machen.")
        }
        .alert("Das ging nicht", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
            Button("OK") {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    // MARK: Bausteine

    private func card<Extra: View>(title: String, subtitle: String, source: String, @ViewBuilder extra: () -> Extra) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.headline)
            Text(subtitle).font(.subheadline).foregroundStyle(Color(.secondaryLabel))
            if let url = URL(string: source) {
                Button("Quelle ansehen") { openURL(url) }
                    .font(.subheadline.weight(.semibold))
                    .buttonStyle(.plain)
                    .foregroundStyle(Color.accentColor)
            }
            extra()
        }
        .padding(.vertical, 4)
    }

    private func buttons(left: (String, () -> Void), right: (String, () -> Void), rightIsDestructive: Bool = false) -> some View {
        HStack {
            Button(left.0, action: left.1)
                .buttonStyle(.plain)
                .foregroundStyle(Color(.label))
            Spacer()
            Button(right.0, action: right.1)
                .buttonStyle(.plain)
                .foregroundStyle(rightIsDestructive ? Color.appDestructive : Color.accentColor)
        }
        .font(.subheadline.weight(.semibold))
    }

    // MARK: Daten

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            async let d: [AgentDraft] = supabase.rpc("get_agent_drafts").execute().value
            async let p: [AgentProposal] = supabase.rpc("get_agent_proposals").execute().value
            async let r: [AgentReport] = supabase.rpc("get_agent_reports").execute().value
            (drafts, proposals, reports) = try await (d, p, r)
            loadFailed = false
        } catch {
            loadFailed = true
        }
    }

    /// Erst sofort aus der Liste nehmen, bei einem Fehler neu laden (wie die Web-App).
    private func run(_ message: String, _ work: () async throws -> Void) async {
        do {
            try await work()
            feed.changed()
        } catch {
            errorMessage = message
        }
        await load()
    }

    private func approve(_ id: UUID) async {
        drafts.removeAll { $0.id == id }
        await run("Der Entwurf konnte nicht freigegeben werden.") {
            try await supabase.rpc("approve_agent_candidate", params: ["p_id": id]).execute()
        }
    }

    private func discard(_ id: UUID) async {
        drafts.removeAll { $0.id == id }
        proposals.removeAll { $0.id == id }
        await run("Das konnte nicht verworfen werden.") {
            try await supabase.rpc("discard_agent_candidate", params: ["p_id": id]).execute()
        }
    }

    private func approveProposal(_ id: UUID) async {
        proposals.removeAll { $0.id == id }
        await run("Der Vorschlag konnte nicht übernommen werden.") {
            try await supabase.rpc("approve_agent_proposal", params: ["p_id": id]).execute()
        }
    }

    private func keep(_ report: AgentReport) async {
        reports.removeAll { $0.eventID == report.eventID }
        await run("Die Meldung konnte nicht geschlossen werden.") {
            try await supabase.rpc("keep_agent_event", params: ["p_event_id": report.eventID]).execute()
        }
    }

    private func remove(_ report: AgentReport) async {
        reports.removeAll { $0.eventID == report.eventID }
        await run("Das Event konnte nicht entfernt werden.") {
            try await supabase.rpc("remove_agent_event", params: ["p_event_id": report.eventID]).execute()
        }
    }

    /// Der Agent läuft montags und donnerstags ab 13:00 UTC (pg_cron).
    static func nextRunDay() -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        let now = Date()
        // Wie nextRunDay der Web-App: 0 = Sonntag, 1 = Montag, 4 = Donnerstag.
        let day = calendar.component(.weekday, from: now) - 1
        let beforeRun = calendar.component(.hour, from: now) < 13
        if day == 1 && beforeRun { return "Montag" }
        return (day >= 1 && day < 4) || (day == 4 && beforeRun) ? "Donnerstag" : "Montag"
    }
}

// MARK: Daten der Admin-Funktionen

nonisolated struct AgentDraft: Decodable, Identifiable {
    let id: UUID
    let title: String
    let startsAt: Date
    let endsAt: Date?
    let location: String
    let price: Double?
    let organizerName: String?
    let sourceURL: String
    let backgroundURL: String
    let description: String
    let duplicateTitle: String?

    enum CodingKeys: String, CodingKey {
        case id, title, location, price, description
        case startsAt = "starts_at"
        case endsAt = "ends_at"
        case organizerName = "organizer_name"
        case sourceURL = "source_url"
        case backgroundURL = "background_url"
        case duplicateTitle = "duplicate_title"
    }

    /// `Mi., 18.11.26 · 22:00–04:00 · 5€`
    var summary: String {
        var text = AdminFormat.dateTime(startsAt)
        if let endsAt { text += "–\(AdminFormat.time(endsAt))" }
        if let price { text += " · \(AdminFormat.price(price))" }
        return text
    }
}

nonisolated struct AgentReport: Decodable, Identifiable {
    let eventID: UUID
    let title: String
    let eventDate: Date
    let reportCount: Int
    let sourceURL: String

    var id: UUID { eventID }

    enum CodingKeys: String, CodingKey {
        case title
        case eventID = "event_id"
        case eventDate = "event_date"
        case reportCount = "report_count"
        case sourceURL = "source_url"
    }
}

nonisolated struct AgentProposal: Decodable, Identifiable {
    let id: UUID
    let kind: String
    let title: String
    let eventDate: Date
    let endsAt: Date?
    let location: String?
    let price: Double?
    let newStartsAt: Date?
    let newEndsAt: Date?
    let newLocation: String?
    let newPrice: Double?
    let sourceURL: String
    let changes: [String: AnyJSON]?

    enum CodingKeys: String, CodingKey {
        case id, kind, title, location, price, changes
        case eventDate = "event_date"
        case endsAt = "ends_at"
        case newStartsAt = "new_starts_at"
        case newEndsAt = "new_ends_at"
        case newLocation = "new_location"
        case newPrice = "new_price"
        case sourceURL = "source_url"
    }

    /// Was sich ändert, in denselben Wörtern wie die Push an die Gäste (approve_agent_proposal).
    var changedWhat: [String] {
        let keys = Set(changes?.keys.map { $0 } ?? [])
        var what: [String] = []
        if keys.contains("starts_at"), let new = newStartsAt {
            if AdminFormat.day(eventDate) != AdminFormat.day(new) { what.append("Datum") }
            if AdminFormat.time(eventDate) != AdminFormat.time(new) { what.append("Uhrzeit") }
        }
        if keys.contains("ends_at") { what.append("Ende") }
        if keys.contains("location") { what.append("Ort") }
        if keys.contains("price") { what.append("Preis") }
        return what
    }

    /// Eine Zeile je Änderung: jetzt → neu.
    var changeLines: [String] {
        var lines: [String] = []
        let what = changedWhat
        if what.contains("Datum") || what.contains("Uhrzeit"), let new = newStartsAt {
            lines.append("\(AdminFormat.dateTime(eventDate)) → \(AdminFormat.dateTime(new))")
        }
        if what.contains("Ende") {
            lines.append("Ende \(endsAt.map(AdminFormat.time) ?? "–") → \(newEndsAt.map(AdminFormat.time) ?? "–")")
        }
        if what.contains("Ort") { lines.append("\(location ?? "–") → \(newLocation ?? "–")") }
        if what.contains("Preis") {
            func text(_ value: Double?) -> String { value.map(AdminFormat.price) ?? "kein Preis" }
            lines.append("\(text(price)) → \(text(newPrice))")
        }
        return lines
    }
}

/// Formate wie im Admin-Screen der Web-App, immer in Leipziger Zeit: `Mi., 18.11.26 · 22:00`, `5€`.
nonisolated enum AdminFormat {
    private static func formatter(_ format: String) -> DateFormatter {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "de_DE")
        formatter.timeZone = TimeZone(identifier: "Europe/Berlin")
        formatter.dateFormat = format
        return formatter
    }

    static func dateTime(_ date: Date) -> String { "\(formatter("EE, dd.MM.yy").string(from: date)) · \(time(date))" }
    static func time(_ date: Date) -> String { formatter("HH:mm").string(from: date) }
    static func day(_ date: Date) -> String { formatter("yyyy-MM-dd").string(from: date) }

    static func price(_ value: Double) -> String {
        value == value.rounded() ? "\(Int(value))€" : String(format: "%.2f€", value).replacingOccurrences(of: ".", with: ",")
    }
}
