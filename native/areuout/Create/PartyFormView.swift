import PhotosUI
import SwiftUI

/// Party erstellen und bearbeiten (Native Redesign 5.6): Bild, Name, Privat, Pflichtkarten,
/// dann die optionalen Module. Jede Karte öffnet ein Sheet von unten.
struct PartyFormView: View {
    enum Mode {
        case create
        case edit(partyID: UUID)
    }

    enum Editor: String, Identifiable {
        case dateTime, location, category
        case description, dresscode, motto, maxGuests, polls, price, website, organizer
        var id: String { rawValue }
    }

    @Environment(\.dismiss) private var dismiss
    @Environment(ProfileStore.self) private var profile

    let mode: Mode
    /// Nach dem Speichern, mit der Party-ID.
    let onSaved: (UUID) -> Void

    @State private var draft: PartyDraft
    @State private var editor: Editor?
    @State private var photoItem: PhotosPickerItem?
    @State private var isSaving = false
    @State private var errorMessage: String?

    init(mode: Mode, draft: PartyDraft = PartyDraft(), onSaved: @escaping (UUID) -> Void) {
        self.mode = mode
        self.onSaved = onSaved
        _draft = State(initialValue: draft)
    }

    private var isEdit: Bool {
        if case .edit = mode { return true }
        return false
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 12) {
                    pictureArea
                    VStack(spacing: 12) {
                        TextField("Party-Name", text: $draft.title)
                            .capsuleField()
                            .onChange(of: draft.title) { _, value in
                                if value.count > PartyDraft.Limits.title { draft.title = String(value.prefix(PartyDraft.Limits.title)) }
                            }
                        Toggle("Privat", isOn: $draft.isPrivate)
                            .padding(.horizontal, 20)
                            .frame(minHeight: 50)
                            .background(Color.appSurface, in: Capsule())

                        requiredCards
                        Divider().padding(.vertical, 8)
                        optionalCards
                    }
                    .padding(.horizontal, 16)
                }
                .padding(.bottom, 32)
            }
            .background(Color.appBackground)
            .ignoresSafeArea(edges: .top)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .close) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if isSaving {
                        ProgressView()
                    } else {
                        Button(role: .confirm, action: save)
                            .disabled(!draft.isComplete)
                    }
                }
            }
            .disabled(isSaving)
        }
        .sheet(item: $editor) { editor in
            editorSheet(editor)
        }
        .onChange(of: photoItem) { _, item in
            Task {
                guard let item, let data = try? await item.loadTransferable(type: Data.self), let image = UIImage(data: data) else { return }
                draft.picture = image
            }
        }
        .alert("Das ging nicht", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
            Button("OK") {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    // MARK: Bild

    private var pictureArea: some View {
        Color.appSeparator
            .frame(height: 260)
            .overlay {
                if let picture = draft.picture {
                    Image(uiImage: picture).resizable().scaledToFill()
                } else if let url = draft.currentPictureURL.flatMap({ Self.pictureURL($0) }) {
                    AsyncImage(url: url) { $0.resizable().scaledToFill() } placeholder: { Color.appSeparator }
                }
            }
            .clipped()
            .overlay(alignment: .bottom) {
                PhotosPicker(selection: $photoItem, matching: .images) {
                    Text(draft.hasPicture ? "Bild bearbeiten" : "Bild hochladen")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color(.label))
                        .padding(.horizontal, 16)
                        .frame(height: 38)
                        .glassEffect(.regular.interactive(), in: Capsule())
                }
                .padding(.bottom, 16)
            }
    }

    static func pictureURL(_ value: String) -> URL? {
        value.hasPrefix("/") ? AppConfig.websiteURL.appending(path: String(value.dropFirst())) : URL(string: value)
    }

    // MARK: Karten

    private var requiredCards: some View {
        VStack(spacing: 12) {
            ModuleCard(
                icon: "calendar", color: .iconDate, name: "Datum und Uhrzeit",
                value: dateText, open: { editor = .dateTime }
            )
            ModuleCard(icon: "shoeprints.fill", color: .iconLocation, name: "Location", value: draft.location?.label, open: { editor = .location })
            ModuleCard(
                icon: "tag.fill", color: .iconCategory, name: "Kategorie",
                value: PartyFormat.category(draft.category, other: draft.categoryOther), open: { editor = .category }
            )
        }
    }

    private var optionalCards: some View {
        VStack(spacing: 12) {
            module("text.alignleft", .iconDescription, "Beschreibung", draft.description, .description) { draft.description = nil }
            module("tshirt.fill", .iconDresscode, "Dresscode", draft.dresscode, .dresscode) { draft.dresscode = nil }
            module("lightbulb.fill", .iconMotto, "Motto", draft.motto, .motto) { draft.motto = nil }
            module("person.2.fill", .iconParticipants, "Max. Teilnehmer", draft.maxGuests.map { "\($0)" }, .maxGuests) { draft.maxGuests = nil }
            ModuleCard(
                icon: "list.bullet", color: .iconPoll, name: "Umfragen",
                value: draft.cleanedPolls.isEmpty ? nil : "",
                open: { editor = .polls },
                clear: draft.cleanedPolls.isEmpty ? nil : { draft.polls = [] },
                preview: draft.cleanedPolls.isEmpty ? nil : AnyView(PollsPreview(polls: draft.cleanedPolls))
            )
            module("eurosign", .iconParticipants, "Preis", draft.price.map { PartyFormat.price($0) }, .price) { draft.price = nil }
            module("link", .iconParticipants, "Website", draft.websiteTitle ?? draft.websiteURL, .website) {
                draft.websiteURL = nil
                draft.websiteTitle = nil
            }
            module("person.crop.square.fill", .iconParticipants, "Veranstalter", draft.organizer, .organizer) { draft.organizer = nil }
        }
    }

    private func module(_ icon: String, _ color: Color, _ name: String, _ value: String?, _ editor: Editor, clear: @escaping () -> Void) -> some View {
        ModuleCard(icon: icon, color: color, name: name, value: value, open: { self.editor = editor }, clear: value == nil ? nil : clear)
    }

    private var dateText: String? {
        guard let start = draft.start else { return nil }
        let times = PartySaver.times(for: draft)
        var text = PartyFormat.cardDate(times.start, allDay: draft.isAllDay)
        if !draft.isAllDay, let end = draft.end {
            text += " bis \(end.formatted(.dateTime.hour().minute().locale(Locale(identifier: "de_DE")))) Uhr"
        }
        _ = start
        return text
    }

    // MARK: Sheets

    @ViewBuilder
    private func editorSheet(_ editor: Editor) -> some View {
        switch editor {
        case .dateTime: DateTimeSheet(draft: draft)
        case .location: LocationSheet(draft: draft)
        case .category: CategorySheet(draft: draft)
        case .description:
            TextModuleSheet(title: "Beschreibung", placeholder: "Beschreibung", limit: PartyDraft.Limits.description, multiline: true,
                            value: draft.description) { draft.description = $0 }
        case .dresscode:
            TextModuleSheet(title: "Dresscode", placeholder: "Dresscode", limit: PartyDraft.Limits.dresscode,
                            value: draft.dresscode) { draft.dresscode = $0 }
        case .motto:
            TextModuleSheet(title: "Motto", placeholder: "Motto", limit: PartyDraft.Limits.motto,
                            value: draft.motto) { draft.motto = $0 }
        case .organizer:
            TextModuleSheet(title: "Veranstalter", placeholder: "Veranstalter", limit: PartyDraft.Limits.organizer,
                            value: draft.organizer) { draft.organizer = $0 }
        case .maxGuests: MaxGuestsSheet(draft: draft)
        case .price: PriceSheet(draft: draft)
        case .website: WebsiteSheet(draft: draft)
        case .polls: PollsSheet(draft: draft)
        }
    }

    // MARK: Speichern

    private func save() {
        guard draft.isComplete, let userID = profile.userID, !isSaving else { return }
        isSaving = true
        Task {
            defer { isSaving = false }
            do {
                switch mode {
                case .create:
                    let id = try await PartySaver.create(draft, userID: userID)
                    dismiss()
                    onSaved(id)
                case .edit(let partyID):
                    try await PartySaver.update(draft, partyID: partyID, userID: userID)
                    dismiss()
                    onSaved(partyID)
                }
            } catch {
                errorMessage = isEdit ? "Deine Änderungen konnten nicht gespeichert werden." : "Deine Party konnte nicht erstellt werden."
            }
        }
    }
}

/// Eine Karte im Formular: Icon, Wert (falls gesetzt) und der graue Knopf, optional ×.
struct ModuleCard: View {
    let icon: String
    let color: Color
    let name: String
    let value: String?
    let open: () -> Void
    var clear: (() -> Void)?
    /// Statt des Werts eine eigene Vorschau, etwa die Umfragen mit ihren Optionen.
    var preview: AnyView?

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 28, height: 28)
                .background(color, in: Circle())
            if let preview {
                preview
            } else if let value {
                Text(value)
                    .font(.subheadline)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Color(.label))
            }
            Button(action: open) {
                Text(value == nil ? name : "\(name) bearbeiten")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Color(.label))
                    .padding(.horizontal, 16)
                    .frame(height: 34)
                    .background(Color.appBackground, in: Capsule())
            }
            .buttonStyle(.plain)
        }
        .padding(16)
        .frame(maxWidth: .infinity)
        .background(Color.appSurface, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(alignment: .topTrailing) {
            if let clear {
                Button(action: clear) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.title3)
                        .foregroundStyle(Color.appPlaceholder)
                }
                .buttonStyle(.plain)
                .padding(10)
                .accessibilityLabel("\(name) entfernen")
            }
        }
    }
}

/// Vorschau der Umfragen auf der Karte, wie im Mockup `bearbeiten`: Frage, darunter jede
/// Option als graue Zeile mit einem leeren Kreis.
struct PollsPreview: View {
    let polls: [PartyDraft.Poll]

    var body: some View {
        VStack(spacing: 14) {
            ForEach(polls) { poll in
                VStack(spacing: 6) {
                    Text(poll.question)
                        .font(.subheadline.weight(.semibold))
                        .multilineTextAlignment(.center)
                    ForEach(Array(poll.options.enumerated()), id: \.offset) { _, option in
                        HStack {
                            Text(option).font(.subheadline)
                            Spacer()
                            Image(systemName: "circle").foregroundStyle(Color(.secondaryLabel))
                        }
                        .padding(.horizontal, 14)
                        .frame(height: 36)
                        .background(Color.appBackground, in: Capsule())
                    }
                }
            }
        }
        .foregroundStyle(Color(.label))
    }
}
