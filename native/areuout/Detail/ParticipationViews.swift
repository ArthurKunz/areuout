import SwiftUI

/// Die Karte im Look des Details, für Inhalte, die mehr als einen Wert zeigen.
struct DetailCardChrome<Content: View>: View {
    let icon: String
    let color: Color
    let title: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 28, height: 28)
                .background(color, in: Circle())
            Text(title).font(.headline)
            content
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appSurface, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    }
}

/// Link unten in einer Karte, wie `Route anzeigen`.
struct CardLink: View {
    let title: String
    let action: () -> Void

    var body: some View {
        VStack(spacing: 8) {
            Divider()
            Button(action: action) {
                HStack {
                    Text(title)
                    Spacer()
                    Image(systemName: "chevron.right")
                }
                .font(.subheadline.weight(.semibold))
            }
            .tint(Color.accentColor)
        }
    }
}

// MARK: Zusage

/// Der Slider `zugesagt` · `vielleicht` · `abgesagt` für Gäste (Native Redesign 5.5).
struct RSVPPicker: View {
    let status: RSVPStatus?
    let onChange: (RSVPStatus) -> Void

    var body: some View {
        Picker("Deine Antwort", selection: Binding(get: { status }, set: { if let new = $0 { onChange(new) } })) {
            ForEach(RSVPStatus.allCases) { option in
                Label(option.label, systemImage: option.icon).tag(Optional(option))
            }
        }
        .pickerStyle(.segmented)
        .padding(.top, 4)
    }
}

/// Der Knopf unten für alle ohne Antwort (Join Request, App Redesign 3.5).
struct JoinBar: View {
    let isPublic: Bool
    let isRequested: Bool
    let isFull: Bool
    let isBusy: Bool
    let join: () -> Void
    let request: () -> Void

    var body: some View {
        Group {
            if isRequested {
                bar("Warten auf Bestätigung", enabled: false) {}
            } else if isFull {
                bar("Diese Party ist voll", enabled: false) {}
            } else if isPublic {
                bar("Teilnehmen", enabled: true, action: join)
            } else {
                bar("Anfragen", enabled: true, action: request)
            }
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
    }

    private func bar(_ title: String, enabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            ZStack {
                Text(title).opacity(isBusy ? 0 : 1)
                if isBusy { ProgressView().tint(.white) }
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.glassProminent)
        .buttonBorderShape(.capsule)
        .controlSize(.extraLarge)
        .disabled(!enabled || isBusy)
    }
}

// MARK: Anfragen (Host)

struct RequestsCard: View {
    let requests: [JoinRequestRow]
    let accept: (JoinRequestRow) -> Void
    let decline: (JoinRequestRow) -> Void

    var body: some View {
        DetailCardChrome(icon: "person.badge.clock.fill", color: .iconParticipants, title: "Anfragen") {
            ForEach(requests) { request in
                HStack(spacing: 10) {
                    AvatarView(
                        url: request.avatarURL,
                        color: request.avatarColor ?? "#C4C4C6",
                        initials: FullName.initials(first: request.firstname, last: request.lastname),
                        size: 32
                    )
                    Text(request.name).font(.subheadline)
                    Spacer()
                    Button("Ablehnen") { decline(request) }
                        .buttonStyle(.bordered)
                        .tint(Color(.label))
                    Button("Annehmen") { accept(request) }
                        .buttonStyle(.borderedProminent)
                }
                .controlSize(.small)
                .buttonBorderShape(.capsule)
            }
        }
    }
}

// MARK: Umfrage

struct PollCard: View {
    let poll: PollData
    let myUserID: UUID?
    let canVote: Bool
    let vote: (UUID) -> Void
    let showVotes: () -> Void

    var body: some View {
        let mine = poll.myOptions(myUserID)
        let total = max(poll.responses.filter { $0.optionID != nil }.count, 1)
        DetailCardChrome(icon: "list.bullet", color: .iconPoll, title: poll.question) {
            ForEach(poll.options) { option in
                let count = poll.votes(for: option.optionID).count
                Button { vote(option.optionID) } label: {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            // Immer rund, auch bei mehreren Antworten (entschieden 2026-10-05).
                            Image(systemName: mine.contains(option.optionID) ? "largecircle.fill.circle" : "circle")
                                .foregroundStyle(mine.contains(option.optionID) ? Color.accentColor : Color.appPlaceholder)
                            Text(option.label).foregroundStyle(Color(.label))
                            Spacer()
                            Text("\(count)").foregroundStyle(.secondary)
                        }
                        .font(.subheadline)
                        GeometryReader { geo in
                            Capsule().fill(Color.appSeparator)
                                .overlay(alignment: .leading) {
                                    Capsule().fill(Color.accentColor)
                                        .frame(width: geo.size.width * CGFloat(count) / CGFloat(total))
                                }
                        }
                        .frame(height: 4)
                    }
                }
                .buttonStyle(.plain)
                .disabled(!canVote)
            }
            if poll.allowMultiple {
                Text("Mehrere Antworten möglich").font(.caption).foregroundStyle(.secondary)
            }
            CardLink(title: "Votes anzeigen", action: showVotes)
        }
    }
}

struct VotesSheet: View {
    @Environment(\.dismiss) private var dismiss
    let poll: PollData

    var body: some View {
        NavigationStack {
            List {
                ForEach(poll.options) { option in
                    let votes = poll.votes(for: option.optionID)
                    Section {
                        if votes.isEmpty {
                            Text("Noch keine Votes").foregroundStyle(.secondary)
                        }
                        ForEach(votes, id: \.userID) { vote in
                            PersonRow(name: vote.name, avatarURL: vote.avatarURL, avatarColor: vote.avatarColor,
                                      first: vote.firstname, last: vote.lastname)
                        }
                    } header: {
                        HStack {
                            Text(option.label)
                            Spacer()
                            Text(votes.count == 1 ? "1 Vote" : "\(votes.count) Votes")
                        }
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.appBackground)
            .navigationTitle(poll.question)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button(role: .close) { dismiss() } }
            }
        }
    }
}

// MARK: Gästeliste

struct GuestListSheet: View {
    @Environment(\.dismiss) private var dismiss
    let partyID: UUID
    let maxGuests: Int?
    let isHost: Bool
    var onChange: () -> Void = {}

    @State private var guests: [GuestRow] = []
    @State private var isLoading = true
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            List {
                Section {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                        tile("Teilnehmer", count(.going))
                        if let maxGuests { tile("Max. Teilnehmer", "max. \(maxGuests)") }
                        tile("Vielleicht", count(.maybe))
                        tile("Abgesagt", count(.notGoing))
                    }
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                }
                Section {
                    if isLoading {
                        ProgressView()
                    } else if guests.isEmpty {
                        Text("Noch keine Gäste").foregroundStyle(.secondary)
                    }
                    ForEach(guests) { guest in
                        HStack {
                            PersonRow(name: guest.name, avatarURL: guest.avatarURL, avatarColor: guest.avatarColor,
                                      first: guest.firstname, last: guest.lastname)
                            Spacer()
                            Image(systemName: RSVPStatus(rawValue: guest.status)?.icon ?? "circle")
                                .foregroundStyle(.secondary)
                        }
                        .swipeActions {
                            if isHost {
                                Button("Entfernen", role: .destructive) { Task { await remove(guest) } }
                            }
                        }
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.appBackground)
            .navigationTitle("Teilnehmer")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button(role: .close) { dismiss() } }
            }
        }
        .task { await load() }
        .alert("Das ging nicht", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
            Button("OK") {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private func count(_ status: RSVPStatus) -> String {
        "\(guests.filter { $0.status == status.rawValue }.count)"
    }

    private func tile(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value).font(.title2.bold())
            Text(title).font(.caption).foregroundStyle(.secondary)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appSurface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private func load() async {
        defer { isLoading = false }
        guests = (try? await Participation.guestList(party: partyID)) ?? []
    }

    private func remove(_ guest: GuestRow) async {
        do {
            try await Participation.removeGuest(guest.userID, party: partyID)
            withAnimation { guests.removeAll { $0.userID == guest.userID } }
            onChange()
        } catch {
            errorMessage = "\(guest.name) konnte nicht entfernt werden."
        }
    }
}

struct PersonRow: View {
    let name: String
    let avatarURL: String?
    let avatarColor: String?
    let first: String?
    let last: String?

    var body: some View {
        HStack(spacing: 10) {
            AvatarView(url: avatarURL, color: avatarColor ?? "#C4C4C6",
                       initials: FullName.initials(first: first, last: last), size: 32)
            Text(name)
        }
    }
}
