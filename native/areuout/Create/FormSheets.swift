import MapKit
import SwiftUI

/// Rahmen aller Formular-Sheets: Titel, ✗ links, ✓ rechts (Mockups `Preis`, `Motto` …).
struct EditorFrame<Content: View>: View {
    @Environment(\.dismiss) private var dismiss
    let title: String
    var canConfirm = true
    var confirm: (() -> Void)?
    @ViewBuilder let content: Content

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 12) { content }
                    .padding(16)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(Color.appBackground)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .close) { dismiss() }
                }
                if let confirm {
                    ToolbarItem(placement: .confirmationAction) {
                        Button(role: .confirm) {
                            confirm()
                            dismiss()
                        }
                        .disabled(!canConfirm)
                    }
                }
            }
        }
    }
}

private func hint(_ text: String) -> some View {
    Text(text).font(.footnote).foregroundStyle(.secondary).frame(maxWidth: .infinity, alignment: .leading).padding(.leading, 20)
}

// MARK: Datum und Uhrzeit

struct DateTimeSheet: View {
    let draft: PartyDraft
    @State private var isAllDay = false
    @State private var start = Date()
    @State private var hasEnd = false
    @State private var end = Date()

    var body: some View {
        let problem = hasEnd ? PartyDraft.endProblem(start: start, end: end) : nil
        EditorFrame(title: "Datum und Uhrzeit", canConfirm: problem == nil, confirm: apply) {
            VStack(spacing: 0) {
                Toggle("Ganztägig", isOn: $isAllDay).padding(14)
                Divider().padding(.leading, 14)
                DatePicker("Start", selection: $start, displayedComponents: isAllDay ? [.date] : [.date, .hourAndMinute])
                    .padding(14)
                // Das Ende steht direkt unter dem Start, der Knopf darunter (Mockup).
                if hasEnd {
                    Divider().padding(.leading, 14)
                    DatePicker("Ende", selection: $end, in: start..., displayedComponents: isAllDay ? [.date] : [.date, .hourAndMinute])
                        .padding(14)
                }
                Divider().padding(.leading, 14)
                Toggle("Ende hinzufügen", isOn: $hasEnd.animation()).padding(14)
            }
            .background(Color.appSurface, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
            .environment(\.locale, Locale(identifier: "de_DE"))
            if let problem { hint(problem) }
        }
        .onAppear(perform: load)
    }

    private func load() {
        isAllDay = draft.isAllDay
        start = draft.start ?? Self.defaultStart()
        hasEnd = draft.end != nil
        end = draft.end ?? start.addingTimeInterval(4 * 3600)
    }

    private func apply() {
        draft.isAllDay = isAllDay
        draft.start = start
        draft.end = hasEnd ? end : nil
    }

    /// Morgen um 20 Uhr als Vorschlag.
    private static func defaultStart() -> Date {
        let calendar = Calendar.current
        let tomorrow = calendar.date(byAdding: .day, value: 1, to: Date()) ?? Date()
        return calendar.date(bySettingHour: 20, minute: 0, second: 0, of: tomorrow) ?? tomorrow
    }
}

// MARK: Location

/// Adresssuche mit Apples Vorschlägen (MKLocalSearchCompleter), auf Leipzig ausgerichtet.
@Observable
final class LocationSearch: NSObject, MKLocalSearchCompleterDelegate {
    var results: [MKLocalSearchCompletion] = []
    private let completer = MKLocalSearchCompleter()

    override init() {
        super.init()
        completer.delegate = self
        completer.resultTypes = [.address, .pointOfInterest]
        completer.region = MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: 51.33, longitude: 12.38),
            span: MKCoordinateSpan(latitudeDelta: 0.5, longitudeDelta: 0.5)
        )
    }

    func search(_ text: String) {
        if text.trimmingCharacters(in: .whitespaces).isEmpty {
            results = []
        } else {
            completer.queryFragment = text
        }
    }

    func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
        results = completer.results
    }

    func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
        results = []
    }

    func resolve(_ completion: MKLocalSearchCompletion) async throws -> PartyDraft.Location {
        let response = try await MKLocalSearch(request: MKLocalSearch.Request(completion: completion)).start()
        guard let item = response.mapItems.first else { throw AuthFailure("Diesen Ort konnte ich nicht finden.") }
        let label = completion.subtitle.isEmpty ? completion.title : "\(completion.title), \(completion.subtitle)"
        let coordinate = item.location.coordinate
        return PartyDraft.Location(label: String(label.prefix(500)), lat: coordinate.latitude, lng: coordinate.longitude)
    }
}

struct LocationSheet: View {
    @Environment(\.dismiss) private var dismiss
    let draft: PartyDraft
    @State private var query = ""
    @State private var search = LocationSearch()
    @State private var errorMessage: String?
    @FocusState private var isFocused: Bool

    var body: some View {
        NavigationStack {
            List {
                ForEach(search.results, id: \.self) { result in
                    Button {
                        Task { await pick(result) }
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            // Color(.secondaryLabel), nicht .secondary: in Knöpfen wird .secondary blau.
                            Text(result.title).foregroundStyle(Color(.label))
                            if !result.subtitle.isEmpty {
                                Text(result.subtitle).font(.footnote).foregroundStyle(Color(.secondaryLabel))
                            }
                        }
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.appBackground)
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Location")
            .searchFocused($isFocused)
            .onChange(of: query) { _, value in search.search(value) }
            .navigationTitle("Location")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button(role: .close) { dismiss() } }
            }
            .overlay {
                if search.results.isEmpty && !query.isEmpty {
                    ContentUnavailableView.search(text: query)
                }
            }
        }
        .onAppear {
            query = draft.location?.label ?? ""
            isFocused = true
        }
        .alert("Das ging nicht", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
            Button("OK") {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private func pick(_ result: MKLocalSearchCompletion) async {
        do {
            draft.location = try await search.resolve(result)
            dismiss()
        } catch {
            errorMessage = "Diesen Ort konnte ich nicht finden. Versuch einen anderen."
        }
    }
}

// MARK: Kategorie

struct CategorySheet: View {
    let draft: PartyDraft
    @State private var selection: String?
    @State private var other = ""

    private let options = [("house", "Hausparty"), ("club", "Club"), ("open_air", "Open-air"), ("festival", "Festival")]

    var body: some View {
        let otherOK = !other.trimmingCharacters(in: .whitespaces).isEmpty && other.count <= PartyDraft.Limits.categoryOther
        EditorFrame(title: "Kategorie", canConfirm: selection != nil && (selection != "other" || otherOK), confirm: apply) {
            VStack(spacing: 0) {
                ForEach(options, id: \.0) { value, label in
                    row(label, value: value)
                    Divider().padding(.leading, 50)
                }
                Button { selection = "other" } label: {
                    HStack(spacing: 12) {
                        radio(selection == "other")
                        TextField("Etwas anderes", text: $other)
                            .onChange(of: other) { _, value in
                                if !value.isEmpty { selection = "other" }
                                if value.count > PartyDraft.Limits.categoryOther { other = String(value.prefix(PartyDraft.Limits.categoryOther)) }
                            }
                    }
                    .padding(14)
                }
                .buttonStyle(.plain)
            }
            .background(Color.appSurface, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        }
        .onAppear {
            selection = draft.category
            other = draft.categoryOther
        }
    }

    private func row(_ label: String, value: String) -> some View {
        Button { selection = value } label: {
            HStack(spacing: 12) {
                radio(selection == value)
                Text(label).foregroundStyle(Color(.label))
                Spacer()
            }
            .padding(14)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func radio(_ on: Bool) -> some View {
        Image(systemName: on ? "largecircle.fill.circle" : "circle")
            .font(.title3)
            .foregroundStyle(on ? Color.accentColor : Color(.label))
    }

    private func apply() {
        draft.category = selection
        draft.categoryOther = selection == "other" ? other.trimmingCharacters(in: .whitespaces) : ""
    }
}

// MARK: Text-Module

struct TextModuleSheet: View {
    let title: String
    let placeholder: String
    let limit: Int
    var multiline = false
    let value: String?
    let save: (String?) -> Void

    @State private var text = ""
    @FocusState private var isFocused: Bool

    var body: some View {
        EditorFrame(title: title, canConfirm: !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, confirm: {
            save(text.trimmingCharacters(in: .whitespacesAndNewlines))
        }) {
            Group {
                if multiline {
                    TextField(placeholder, text: $text, axis: .vertical)
                        .lineLimit(6...12)
                        .padding(18)
                        .background(Color.appSurface, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
                } else {
                    TextField(placeholder, text: $text).capsuleField()
                }
            }
            .focused($isFocused)
            .onChange(of: text) { _, new in
                if new.count > limit { text = String(new.prefix(limit)) }
            }
            if multiline { hint("\(text.count) / \(limit)") }
        }
        .onAppear {
            text = value ?? ""
            isFocused = true
        }
    }
}

struct MaxGuestsSheet: View {
    let draft: PartyDraft
    @State private var text = ""
    @FocusState private var isFocused: Bool

    var body: some View {
        let number = Int(text) ?? 0
        let valid = (1...PartyDraft.Limits.maxGuests).contains(number)
        EditorFrame(title: "max. Teilnehmer", canConfirm: valid, confirm: { draft.maxGuests = number }) {
            TextField("max. Teilnehmer", text: $text)
                .keyboardType(.numberPad)
                .focused($isFocused)
                .capsuleField()
            if !text.isEmpty && !valid { hint("Zwischen 1 und \(PartyDraft.Limits.maxGuests).") }
        }
        .onAppear {
            text = draft.maxGuests.map { "\($0)" } ?? ""
            isFocused = true
        }
    }
}

struct PriceSheet: View {
    let draft: PartyDraft
    @State private var text = ""
    @FocusState private var isFocused: Bool

    var body: some View {
        let value = Double(text.replacingOccurrences(of: ",", with: "."))
        let decimals = text.split(whereSeparator: { $0 == "," || $0 == "." }).dropFirst().first?.count ?? 0
        let valid = value.map { $0 >= 0 && $0 <= 9999.99 && decimals <= 2 } ?? false
        EditorFrame(title: "Preis", canConfirm: valid, confirm: { draft.price = value }) {
            HStack {
                TextField("Preis", text: $text).keyboardType(.decimalPad).focused($isFocused)
                Text("€").foregroundStyle(.secondary)
            }
            .capsuleField()
            hint(valid && value == 0 ? "0 € erscheint als „Kostenlos“." : "In Euro, z. B. 5,50. 0 heißt kostenlos.")
        }
        .onAppear {
            if let price = draft.price {
                text = price.formatted(.number.precision(.fractionLength(0...2)).locale(Locale(identifier: "de_DE")).grouping(.never))
            }
            isFocused = true
        }
    }
}

struct WebsiteSheet: View {
    let draft: PartyDraft
    @State private var link = ""
    @State private var title = ""
    @FocusState private var isFocused: Bool

    var body: some View {
        let url = PartyDraft.normalizedWebsite(link)
        EditorFrame(title: "Link", canConfirm: url != nil, confirm: {
            draft.websiteURL = url
            let trimmed = title.trimmingCharacters(in: .whitespaces)
            draft.websiteTitle = trimmed.isEmpty ? nil : trimmed
        }) {
            TextField("Link", text: $link)
                .keyboardType(.URL)
                .textContentType(.URL)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .focused($isFocused)
                .capsuleField()
            TextField("Titel", text: $title)
                .capsuleField()
                .onChange(of: title) { _, value in
                    if value.count > PartyDraft.Limits.websiteTitle { title = String(value.prefix(PartyDraft.Limits.websiteTitle)) }
                }
            if !link.isEmpty && url == nil { hint("Das sieht nicht nach einem Link aus.") }
        }
        .onAppear {
            link = draft.websiteURL ?? ""
            title = draft.websiteTitle ?? ""
            isFocused = true
        }
    }
}

// MARK: Umfragen

/// Bearbeitbare Umfrage mit stabilen IDs pro Option, damit Löschen nie einen
/// veralteten Index trifft (der Papierkorb stürzte deshalb ab).
private struct EditablePoll: Identifiable {
    struct Option: Identifiable {
        let id = UUID()
        var text: String
    }

    let id = UUID()
    var question: String
    var options: [Option]
    var allowMultiple: Bool

    init(_ poll: PartyDraft.Poll) {
        question = poll.question
        options = poll.options.map { Option(text: $0) }
        if options.count < 2 { options += Array(repeating: Option(text: ""), count: 2 - options.count) }
        allowMultiple = poll.allowMultiple
    }

    var asDraft: PartyDraft.Poll {
        PartyDraft.Poll(question: question, options: options.map(\.text), allowMultiple: allowMultiple)
    }
}

/// Umfragen (Mockup `Umfragen`): je eine Karte mit Frage und Optionen, darunter der
/// Schalter als eigene Zeile. Löschen: die Karte nach links wischen.
struct PollsSheet: View {
    @Environment(\.dismiss) private var dismiss
    let draft: PartyDraft
    @State private var polls: [EditablePoll] = []

    var body: some View {
        let cleaned = cleaned
        let valid = cleaned.allSatisfy { !$0.question.isEmpty && $0.options.count >= 2 }
        NavigationStack {
            List {
                ForEach($polls) { $poll in
                    Section {
                        pollCard($poll)
                            .listRowInsets(EdgeInsets())
                            .listRowBackground(Color.appSurface)
                            .swipeActions(edge: .trailing) {
                                Button("Löschen", systemImage: "trash", role: .destructive) {
                                    withAnimation { polls.removeAll { $0.id == poll.id } }
                                }
                            }
                    }
                    .listSectionSpacing(8)
                    // Der Schalter als eigene Zeile unter der Karte (Mockup).
                    Section {
                        Toggle("Mehrere Antworten erlauben", isOn: $poll.allowMultiple)
                            .listRowBackground(Color.appSurface)
                    }
                    .listSectionSpacing(24)
                }
                if polls.count < PartyDraft.Limits.polls {
                    Section {
                        Button("Umfrage hinzufügen", systemImage: "plus") {
                            withAnimation { polls.append(EditablePoll(PartyDraft.Poll())) }
                        }
                        .foregroundStyle(Color(.label))
                        .frame(maxWidth: .infinity, alignment: .center)
                    }
                    .listRowBackground(Color.appSurface)
                }
                if !valid {
                    Text("Jede Umfrage braucht eine Frage und mindestens zwei Optionen.")
                        .font(.footnote)
                        .foregroundStyle(Color(.secondaryLabel))
                        .listRowBackground(Color.clear)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.appBackground)
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle("Umfragen")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button(role: .close) { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(role: .confirm) {
                        draft.polls = cleaned
                        dismiss()
                    }
                    .disabled(!valid)
                }
            }
        }
        .onAppear {
            polls = (draft.polls.isEmpty ? [PartyDraft.Poll()] : draft.polls).map { EditablePoll($0) }
        }
    }

    private func pollCard(_ poll: Binding<EditablePoll>) -> some View {
        VStack(spacing: 0) {
            TextField("Frage", text: poll.question)
                .font(.body.weight(.semibold))
                .onChange(of: poll.wrappedValue.question) { _, value in
                    if value.count > PartyDraft.Limits.pollQuestion { poll.wrappedValue.question = String(value.prefix(PartyDraft.Limits.pollQuestion)) }
                }
                .padding(14)
            ForEach(poll.options) { $option in
                Divider().padding(.leading, 14)
                TextField("Option", text: $option.text)
                    .onChange(of: option.text) { _, value in
                        if value.count > PartyDraft.Limits.option { option.text = String(value.prefix(PartyDraft.Limits.option)) }
                    }
                    .padding(14)
            }
            if poll.wrappedValue.options.count < 10 {
                Divider().padding(.leading, 14)
                Button("Option hinzufügen") { poll.wrappedValue.options.append(.init(text: "")) }
                    .buttonStyle(.plain)
                    .foregroundStyle(Color(.label))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(14)
            }
        }
    }

    private var cleaned: [PartyDraft.Poll] {
        let copy = PartyDraft()
        copy.polls = polls.map(\.asDraft)
        return copy.cleanedPolls
    }
}
