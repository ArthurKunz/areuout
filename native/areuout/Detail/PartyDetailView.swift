import MapKit
import SwiftUI

/// Party-Detail (Native Redesign 5.5): Foto oben mit Glas-Knöpfen, darunter Titel, Host und
/// die Karten. Rolle (Host, Gast, fremd) bestimmt das ⋯-Menü.
struct PartyDetailView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(ProfileStore.self) private var profile

    /// Wird nach Löschen oder Antwort-Löschen gerufen, damit Karte und Listen neu laden.
    var onChange: () -> Void = {}

    @State private var model: PartyDetailModel
    @State private var askDelete = false
    @State private var askReset = false
    @State private var askReport = false
    @State private var showNewLink = false
    @State private var notice: (title: String, message: String)?
    @State private var errorMessage: String?
    @State private var isBusy = false
    @State private var isAnswering = false
    @State private var showGuests = false
    @State private var votesFor: PollData?
    @State private var editDraft: PartyDraft?

    init(partyID: UUID, onChange: @escaping () -> Void = {}) {
        _model = State(initialValue: PartyDetailModel(partyID: partyID))
        self.onChange = onChange
    }

    init(model: PartyDetailModel) {
        _model = State(initialValue: model)
    }

    private var role: PartyDetailModel.Role { model.role(for: profile.userID, isAdmin: profile.isAdmin) }

    private var shareURL: URL? {
        // Partys des Agents sind öffentlich und haben keinen Einladungslink zum Weitergeben.
        role == .host && !model.isAgentEvent ? model.inviteURL : DeepLinkRouter.guestURL(for: model.partyID)
    }

    /// Über den Host-Link geöffnet: noch keine Antwort, aber schon Zugang zur privaten Party.
    /// Dann gibt es die drei Antworten statt `Anfragen` (App Redesign 4.3).
    private var hasInviteAccess: Bool {
        guard let detail = model.detail else { return false }
        return role == .stranger && !detail.isPublic && detail.isExact && !model.isRequested
    }

    var body: some View {
        Group {
            if let detail = model.detail {
                content(detail)
            } else if model.loadFailed {
                ContentUnavailableView {
                    Label("Nicht geladen", systemImage: "wifi.exclamationmark")
                } description: {
                    Text("Diese Party konnte nicht geladen werden.")
                } actions: {
                    Button("Nochmal versuchen") { Task { await model.load(userID: profile.userID, isAdmin: profile.isAdmin) } }
                }
            } else {
                ProgressView()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.appBackground)
        // Neu laden, sobald das eigene Profil da ist: über eine Mitteilung startet die Party,
        // bevor die App weiß, wer eingeloggt ist, und ohne das fehlen Host-Teile wie `Anfragen`.
        .task(id: "\(profile.userID?.uuidString ?? "")\(profile.isAdmin)") { await model.load(userID: profile.userID, isAdmin: profile.isAdmin) }
        // Und jedes Mal, wenn die App wieder nach vorne kommt (etwa über eine neue Mitteilung).
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { Task { await model.load(userID: profile.userID, isAdmin: profile.isAdmin) } }
        }
        // Alerts statt confirmationDialog: iOS 26 zeigt im Dialog keinen Abbrechen-Knopf,
        // im Alert steht er grau neben oder unter dem roten (Arthur, 2026-11-22).
        .alert("Möchtest du die Party wirklich löschen?", isPresented: $askDelete) {
            Button("Löschen", role: .destructive) { Task { await deleteTapped() } }
            Button("Abbrechen", role: .cancel) {}
        } message: {
            if role == .host && model.isAgentEvent {
                Text("Das Event verschwindet für alle, und der Agent nimmt diese Quelle nicht wieder auf.")
            }
        }
        .alert("Möchtest du den Link wirklich resetten?", isPresented: $askReset) {
            Button("Link resetten", role: .destructive) { Task { await resetLink() } }
            Button("Abbrechen", role: .cancel) {}
        } message: {
            Text("Der alte Link funktioniert danach nicht mehr. Wer ihn schon hat, kommt nicht mehr rein.")
        }
        .alert("Weshalb meldest du die Party?", isPresented: $askReport) {
            ForEach(reportReasons, id: \.self) { reason in
                Button(reason.label, role: .destructive) { Task { await report(reason) } }
            }
            Button("Abbrechen", role: .cancel) {}
        }
        .sheet(isPresented: $showNewLink) {
            NewLinkSheet(url: model.inviteURL)
        }
        .sheet(isPresented: $showGuests) {
            GuestListSheet(partyID: model.partyID, maxGuests: model.detail?.maxGuests, isHost: role == .host) {
                Task { await reload() }
            }
        }
        .sheet(item: $votesFor) { poll in VotesSheet(poll: poll) }
        .sheet(item: $editDraft) { draft in
            PartyFormView(mode: .edit(partyID: model.partyID), draft: draft) { _ in
                Task { await reload() }
            }
        }

        .alert(notice?.title ?? "", isPresented: Binding(get: { notice != nil }, set: { if !$0 { notice = nil } })) {
            Button("Fertig") {}
        } message: {
            Text(notice?.message ?? "")
        }
        .alert("Das ging nicht", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
            Button("OK") {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    // MARK: Inhalt

    private func content(_ detail: PartyDetail) -> some View {
        ScrollView {
            VStack(spacing: 0) {
                // Das Bild füllt die Fläche, bestimmt aber nicht die Breite der Seite.
                Color.appPlaceholder
                    .frame(height: 320)
                    .overlay {
                        AsyncImage(url: detail.imageURL) { image in
                            image.resizable().scaledToFill()
                        } placeholder: {
                            Color.appPlaceholder
                        }
                    }
                    .clipped()

                VStack(spacing: 16) {
                    header(detail)
                    cards(detail)
                }
                .padding(.horizontal, 16)
                .padding(.top, 20)
                .padding(.bottom, 32)
                .background(Color.appBackground, in: UnevenRoundedRectangle(topLeadingRadius: 32, topTrailingRadius: 32, style: .continuous))
                .offset(y: -32)
                .padding(.bottom, -32)
            }
        }
        .ignoresSafeArea(edges: .top)
        // Die Glas-Knöpfe wachsen wie Apples eigene Leisten nur bis zu einer Grenze mit.
        .overlay(alignment: .top) { topBar(detail).dynamicTypeSize(...DynamicTypeSize.xxLarge) }
        .safeAreaInset(edge: .bottom) {
            // Wer noch nicht geantwortet hat: Teilnehmen, Anfragen, Warten oder voll.
            if role == .stranger, !hasInviteAccess, !model.isCancelled {
                JoinBar(
                    isPublic: detail.isPublic,
                    isRequested: model.isRequested,
                    isFull: model.isFull,
                    isBusy: isAnswering,
                    join: { Task { await answer(.going) } },
                    request: { Task { await requestToJoin() } }
                )
            }
        }
        .disabled(isBusy)
    }

    private func topBar(_ detail: PartyDetail) -> some View {
        HStack {
            Button { dismiss() } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 17, weight: .semibold))
                    .frame(width: 44, height: 44)
            }
            .glassEffect(.regular.interactive(), in: Circle())
            .accessibilityLabel("Schließen")

            Spacer()

            HStack(spacing: 0) {
                // Host teilt den Einladungslink, alle anderen den Gast-Link (Native Redesign 6).
                if let url = shareURL {
                    ShareLink(item: url) {
                        Image(systemName: "square.and.arrow.up")
                            .frame(width: 44, height: 44)
                    }
                    .accessibilityLabel("Teilen")
                }
                Menu {
                    menuItems
                } label: {
                    Image(systemName: "ellipsis")
                        .frame(width: 44, height: 44)
                }
                .accessibilityLabel("Mehr")
            }
            .font(.system(size: 17, weight: .semibold))
            .glassEffect(.regular.interactive(), in: Capsule())
        }
        // Der Chip steht in der Mitte der ganzen Seite, nicht zwischen den Knöpfen.
        .overlay {
            Text(detail.isPublic ? "Öffentlich" : "Privat")
                .font(.subheadline.weight(.semibold))
                .padding(.horizontal, 14)
                .frame(height: 36)
                .glassEffect(.regular, in: Capsule())
        }
        .foregroundStyle(Color(.label))
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }

    @ViewBuilder
    private var menuItems: some View {
        switch role {
        case .host:
            if !model.isAgentEvent {
                Button("Link-reset", systemImage: "link") { askReset = true }
            }
            Button("bearbeiten", systemImage: "pencil") {
                if let detail = model.detail { editDraft = PartyDraft.from(detail, polls: model.polls) }
            }
            Button("Party löschen", systemImage: "trash", role: .destructive) { askDelete = true }
        case .guest:
            Button("Party melden", systemImage: "exclamationmark.bubble") { askReport = true }
            Button("Party löschen", systemImage: "trash", role: .destructive) { askDelete = true }
        case .stranger:
            Button("Party melden", systemImage: "exclamationmark.bubble") { askReport = true }
        }
    }

    private func header(_ detail: PartyDetail) -> some View {
        VStack(spacing: 6) {
            Text(detail.title)
                .font(.title.bold())
                .multilineTextAlignment(.center)
            HStack(spacing: 6) {
                Text("von")
                AvatarView(
                    url: detail.hostAvatarURL,
                    color: detail.hostAvatarColor ?? "#C4C4C6",
                    initials: FullName.initials(first: detail.hostFirstname, last: detail.hostLastname),
                    size: 20
                )
                Text(detail.hostName)
            }
            .font(.subheadline)
            if role == .guest || hasInviteAccess, !model.isCancelled {
                RSVPPicker(status: model.myStatus) { status in Task { await answer(status) } }
                    .disabled(isAnswering)
            }
            if model.agent?.cancelledAt != nil {
                Text("Abgesagt")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 4)
                    .background(Color.appDestructive, in: Capsule())
            }
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: Karten

    private func cards(_ detail: PartyDetail) -> some View {
        let items = cardItems(detail)
        let canTakePart = role != .stranger && !model.isCancelled
        return VStack(spacing: 12) {
            ForEach(Array(rows(items).enumerated()), id: \.offset) { _, row in
                HStack(alignment: .top, spacing: 12) {
                    ForEach(row, id: \.title) { item in
                        DetailCard(item: item)
                    }
                }
            }
            if role == .host, !model.requests.isEmpty {
                RequestsCard(
                    requests: model.requests,
                    accept: { request in Task { await decide(request, accept: true) } },
                    decline: { request in Task { await decide(request, accept: false) } }
                )
            }
            // Umfragen: sichtbar, wem der Server sie gibt, nutzbar nur mit Antwort. Fragen gibt es
            // in der nativen App nicht mehr (entschieden 2026-11-20).
            ForEach(model.polls.filter { !$0.isQuestion }) { poll in
                PollCard(poll: poll, myUserID: profile.userID, canVote: canTakePart && role != .host,
                         vote: { option in Task { await vote(option, in: poll) } },
                         showVotes: { votesFor = poll })
            }
        }
    }

    private func cardItems(_ detail: PartyDetail) -> [DetailCardItem] {
        var items: [DetailCardItem] = [
            DetailCardItem(icon: "calendar", color: .iconDate, title: "Datum", value: PartyFormat.date(detail.eventDate), isHalf: true),
            DetailCardItem(icon: "clock", color: .iconTime, title: "Uhrzeit", value: PartyFormat.time(detail), isHalf: true),
        ]
        if let location = detail.location, detail.isExact {
            items.append(DetailCardItem(
                icon: "shoeprints.fill", color: .iconLocation, title: "Location", value: location,
                link: ("Route anzeigen", { openRoute(detail) })
            ))
        }
        if let dresscode = detail.dresscode {
            items.append(DetailCardItem(icon: "tshirt.fill", color: .iconDresscode, title: "Dresscode", value: dresscode, isHalf: true))
        }
        if let motto = detail.motto {
            items.append(DetailCardItem(icon: "lightbulb.fill", color: .iconMotto, title: "Motto", value: motto, isHalf: true))
        }
        items.append(DetailCardItem(
            icon: "person.2.fill", color: .iconParticipants, title: "Teilnehmer", value: participantsText(detail),
            link: role == .stranger && !detail.isPublic ? nil : ("Gästeliste anzeigen", { showGuests = true })
        ))
        if let description = detail.description {
            items.append(DetailCardItem(icon: "text.alignleft", color: .iconDescription, title: "Beschreibung", value: description))
        }
        if let category = PartyFormat.category(detail.category, other: detail.categoryOther) {
            items.append(DetailCardItem(icon: "tag.fill", color: .iconCategory, title: "Kategorie", value: category, isHalf: true))
        }
        if let price = detail.price {
            items.append(DetailCardItem(icon: "eurosign", color: .iconParticipants, title: "Preis", value: PartyFormat.price(price), isHalf: true))
        }
        if let website = detail.websiteURL, let url = URL(string: website) {
            items.append(DetailCardItem(
                icon: "link", color: .iconParticipants, title: "Website",
                value: detail.websiteTitle ?? url.host(),
                link: ("Öffnen", { openURL(url) })
            ))
        }
        if let organizer = detail.organizerName ?? model.agent?.organizerName {
            items.append(DetailCardItem(icon: "person.crop.square.fill", color: .iconParticipants, title: "Veranstalter", value: organizer))
        }
        return items
    }

    /// Zwei halbe Karten nebeneinander, eine halbe ohne Partner wird voll breit.
    private func rows(_ items: [DetailCardItem]) -> [[DetailCardItem]] {
        var rows: [[DetailCardItem]] = []
        var index = 0
        while index < items.count {
            let item = items[index]
            // Bei sehr großer Schrift steht jede Karte allein, sonst brechen die Wörter.
            if item.isHalf, !typeSize.isAccessibilitySize, index + 1 < items.count, items[index + 1].isHalf {
                rows.append([item, items[index + 1]])
                index += 2
            } else {
                rows.append([item])
                index += 1
            }
        }
        return rows
    }

    private func participantsText(_ detail: PartyDetail) -> String {
        let going = model.counts?.goingCount ?? model.agent?.goingCount ?? 0
        var text = going == 1 ? "1 zugesagt" : "\(going) zugesagt"
        if let max = detail.maxGuests { text += " · max. \(max)" }
        return text
    }

    private func openRoute(_ detail: PartyDetail) {
        guard let lat = detail.lat, let lng = detail.lng else { return }
        let item = MKMapItem(location: CLLocation(latitude: lat, longitude: lng), address: nil)
        item.name = detail.location ?? detail.title
        item.openInMaps(launchOptions: [MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeDefault])
    }

    private var reportReasons: [PartyDetailModel.ReportReason] {
        // `Ich bin der Veranstalter` nur bei Partys des Agents, wie in der Web-App.
        PartyDetailModel.ReportReason.allCases.filter { $0 != .organizer || model.isAgentEvent }
    }

    // MARK: Aktionen

    private func deleteTapped() async {
        isBusy = true
        defer { isBusy = false }
        do {
            switch role {
            case .host:
                if model.isAgentEvent {
                    try await model.removeAgentEvent()
                } else {
                    try await model.deleteParty()
                }
                onChange()
                dismiss()
            case .guest:
                guard let userID = profile.userID else { return }
                try await model.removeMyAnswer(userID: userID)
                onChange()
                await model.load(userID: profile.userID, isAdmin: profile.isAdmin)
            case .stranger:
                return
            }
        } catch {
            errorMessage = "Das hat nicht geklappt. Versuch es nochmal."
        }
    }

    private func reload() async {
        await model.load(userID: profile.userID, isAdmin: profile.isAdmin)
        onChange()
    }

    private func answer(_ status: RSVPStatus) async {
        guard let userID = profile.userID else { return }
        isAnswering = true
        defer { isAnswering = false }
        do {
            try await Participation.setStatus(status, party: model.partyID, user: userID)
            // Wie die Web-App: nach zugesagt oder vielleicht einmal um Mitteilungen bitten.
            if status != .notGoing { PushManager.shared.ask() }
            await reload()
        } catch {
            errorMessage = Participation.rsvpErrorText(error)
        }
    }

    private func requestToJoin() async {
        isAnswering = true
        defer { isAnswering = false }
        do {
            try await Participation.requestToJoin(party: model.partyID)
            PushManager.shared.ask()
            await reload()
        } catch {
            errorMessage = "Deine Anfrage konnte nicht gesendet werden."
        }
    }

    private func decide(_ request: JoinRequestRow, accept: Bool) async {
        do {
            if accept {
                try await Participation.accept(request.userID, party: model.partyID)
            } else {
                try await Participation.decline(request.userID, party: model.partyID)
            }
            await reload()
        } catch {
            errorMessage = accept ? "Die Anfrage konnte nicht angenommen werden. Ist die Party voll?" : "Die Anfrage konnte nicht abgelehnt werden."
        }
    }

    private func vote(_ option: UUID, in poll: PollData) async {
        guard let userID = profile.userID else { return }
        do {
            try await Participation.vote(option, in: poll, user: userID)
            await model.load(userID: userID, isAdmin: profile.isAdmin)
        } catch {
            errorMessage = "Deine Stimme konnte nicht gespeichert werden."
        }
    }

    private func resetLink() async {
        isBusy = true
        defer { isBusy = false }
        do {
            try await model.resetInviteLink()
            showNewLink = true
        } catch {
            errorMessage = "Der Link konnte nicht zurückgesetzt werden."
        }
    }

    private func report(_ reason: PartyDetailModel.ReportReason) async {
        do {
            try await model.report(reason)
            notice = ("Danke für deine Meldung", "Wir sehen sie uns innerhalb von 24 Stunden an. Die gemeldete Person erfährt nicht, dass die Meldung von dir kommt.")
        } catch {
            errorMessage = "Deine Meldung konnte nicht gesendet werden."
        }
    }
}

/// Nach dem Link-Reset: der neue Link zum Weiterschicken (Texte aus Link-Reset bei geleaktem Invite).
private struct NewLinkSheet: View {
    @Environment(\.dismiss) private var dismiss
    let url: URL?

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 44))
                .foregroundStyle(Color.iconTime)
            Text("Link zurückgesetzt").font(.title3.bold())
            Text("Schick den neuen Link an alle, die weiter dabei sein sollen.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            if let url {
                ShareLink(item: url) {
                    Text("Teilen").frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .buttonBorderShape(.capsule)
                .controlSize(.extraLarge)
            }
            Button("Fertig") { dismiss() }
                .tint(Color(.label))
        }
        .padding(24)
        .presentationDetents([.medium])
    }
}
