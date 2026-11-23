import Supabase
import SwiftUI

/// Parties-Tab (Native Redesign 5.3): Titel, Filter und Profilbild oben, darunter die Reihen
/// `Upcoming`, `Going` und `Hosting` mit großen Foto-Karten.
struct PartiesView: View {
    @Environment(ProfileStore.self) private var profile
    @Environment(PartyFeed.self) private var feed
    let openProfile: () -> Void
    /// Nur im Simulator ohne Login (-uiPreviewParties): Beispieldaten statt Server.
    var sample: [PartySummary]?

    @State private var upcoming: [PartySummary] = []
    @State private var going: [PartySummary] = []
    @State private var hosting: [PartySummary] = []
    @State private var isLoading = true
    @State private var loadFailed = false
    @State private var selected: PartySummary?
    @State private var filter = PartyFilter()
    @State private var day: Date?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                VStack(alignment: .leading, spacing: 12) {
                    header
                    DateFilterBar(day: $day)
                }
                if isLoading && upcoming.isEmpty && going.isEmpty && hosting.isEmpty {
                    ProgressView().frame(maxWidth: .infinity).padding(.top, 80)
                } else if loadFailed {
                    ContentUnavailableView {
                        Label("Nicht geladen", systemImage: "wifi.exclamationmark")
                    } description: {
                        Text("Die Partys konnten nicht geladen werden.")
                    } actions: {
                        Button("Nochmal versuchen") { Task { await load() } }
                    }
                } else if rows.allSatisfy({ $0.parties.isEmpty }) {
                    ContentUnavailableView(
                        isFiltering ? "Nichts gefunden" : "Noch keine Partys",
                        systemImage: "party.popper",
                        description: Text(isFiltering ? (day != nil && !filter.isActive ? "An diesem Tag gibt es keine Party." : "Keine Party passt zu deinem Filter.") : "Sobald es Partys gibt, findest du sie hier.")
                    )
                    .padding(.top, 40)
                } else {
                    ForEach(rows, id: \.title) { row in
                        if !row.parties.isEmpty {
                            PartyRow(title: row.title, parties: row.parties, badge: row.badge) { selected = $0 }
                        }
                    }
                }
            }
            .padding(.bottom, 24)
        }
        .background(Color.appBackground)
        .refreshable { await load() }
        .task(id: feed.version) { await load() }
        .sheet(item: $selected) { party in
            PartyDetailView(partyID: party.id) { feed.changed() }
        }
    }

    // MARK: Kopf

    private var header: some View {
        HStack(alignment: .center, spacing: 12) {
            Text("Parties").font(.largeTitle.bold())
            Spacer()
            FilterMenu(filter: $filter)
            Button(action: openProfile) {
                AvatarView(
                    url: profile.profile?.avatarURL,
                    color: profile.profile?.avatarColor ?? "#C4C4C6",
                    initials: profile.initials,
                    size: 40
                )
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Profil")
        }
        .padding(.horizontal, 20)
        .padding(.top, 8)
    }

    // MARK: Daten

    private var rows: [(title: String, parties: [PartySummary], badge: PartyCard.Badge)] {
        [
            ("Upcoming", filter.apply(upcoming).on(day), .days),
            ("Going", filter.apply(going).on(day), .status),
            ("Hosting", filter.apply(hosting).on(day), .none),
        ]
    }

    private var isFiltering: Bool { filter.isActive || day != nil }

    private func load() async {
        if let sample {
            (upcoming, going, hosting) = (sample, Array(sample.prefix(2)), Array(sample.suffix(1)))
            isLoading = false
            return
        }
        isLoading = true
        defer { isLoading = false }
        do {
            async let explore: [PartySummary] = supabase.rpc("get_explore_parties").execute().value
            async let mine: [PartySummary] = supabase.rpc("get_my_parties").execute().value
            async let hosted: [PartySummary] = supabase.rpc("get_hosting_parties").execute().value
            (upcoming, going, hosting) = try await (explore, mine, hosted)
            loadFailed = false
        } catch {
            loadFailed = true
        }
    }
}

// MARK: Filter

/// Öffentlich/Privat und die Kategorien, mehrere gleichzeitig. Nichts gewählt heißt: kein Filter.
struct PartyFilter: Equatable {
    var visibility: Set<String> = []
    var categories: Set<String> = []

    static let categoryOptions = [("house", "Hausparty"), ("club", "Club"), ("open_air", "Open-air"), ("festival", "Festival"), ("other", "Sonstiges")]

    var isActive: Bool { !visibility.isEmpty || !categories.isEmpty }

    func apply(_ parties: [PartySummary]) -> [PartySummary] {
        parties.filter { party in
            let visibilityOK = visibility.isEmpty || visibility.contains(party.isPublic ? "public" : "private")
            let categoryOK = categories.isEmpty || categories.contains(party.category ?? "")
            return visibilityOK && categoryOK
        }
    }
}

private struct FilterMenu: View {
    @Binding var filter: PartyFilter

    var body: some View {
        Menu {
            Section {
                toggle("Öffentlich", isOn: filter.visibility.contains("public")) { flip(&filter.visibility, "public") }
                toggle("Privat", isOn: filter.visibility.contains("private")) { flip(&filter.visibility, "private") }
            }
            Section {
                ForEach(PartyFilter.categoryOptions, id: \.0) { value, label in
                    toggle(label, isOn: filter.categories.contains(value)) { flip(&filter.categories, value) }
                }
            }
            if filter.isActive {
                Button("Filter zurücksetzen", systemImage: "xmark.circle") { filter = PartyFilter() }
            }
        } label: {
            Image(systemName: filter.isActive ? "line.3.horizontal.decrease.circle.fill" : "line.3.horizontal.decrease")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Color(.label))
                .frame(width: 40, height: 40)
                .glassEffect(.regular.interactive(), in: Circle())
        }
        .menuActionDismissBehavior(.disabled)
        .accessibilityLabel("Filter")
    }

    private func toggle(_ title: String, isOn: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            if isOn {
                Label(title, systemImage: "checkmark")
            } else {
                Text(title)
            }
        }
    }

    private func flip(_ set: inout Set<String>, _ value: String) {
        if set.contains(value) { set.remove(value) } else { set.insert(value) }
    }
}

// MARK: Reihen und Karten

private struct PartyRow: View {
    let title: String
    let parties: [PartySummary]
    let badge: PartyCard.Badge
    let open: (PartySummary) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.title3.bold())
                .padding(.horizontal, 20)
            ScrollView(.horizontal) {
                LazyHStack(spacing: 12) {
                    ForEach(parties) { party in
                        Button { open(party) } label: {
                            PartyCard(party: party, badge: badge)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .scrollTargetLayout()
            }
            .scrollTargetBehavior(.viewAligned)
            .contentMargins(.horizontal, 20, for: .scrollContent)
            .scrollIndicators(.hidden)
        }
    }
}

/// Große Foto-Karte: Kategorie oben links, rechts Tage oder Status, unten Titel und Datum
/// auf Glas (Mockup `Parties`).
struct PartyCard: View {
    enum Badge {
        case days, status, none
    }

    let party: PartySummary
    let badge: Badge

    var body: some View {
        Color.appPlaceholder
            .overlay {
                AsyncImage(url: party.imageURL) { $0.resizable().scaledToFill() } placeholder: { Color.appPlaceholder }
            }
            .frame(width: 300, height: 360)
            .clipShape(RoundedRectangle(cornerRadius: 32, style: .continuous))
            .overlay(alignment: .topLeading) {
                if let category = PartyFormat.category(party.category, other: party.categoryOther) {
                    Text(category)
                        .font(.footnote.weight(.semibold))
                        .padding(.horizontal, 12)
                        .frame(height: 30)
                        .glassEffect(.regular, in: Capsule())
                        .padding(14)
                }
            }
            .overlay(alignment: .topTrailing) {
                badgeView.padding(14)
            }
            .overlay(alignment: .bottom) {
                VStack(spacing: 4) {
                    Text(party.title)
                        .font(.title3.bold())
                        .lineLimit(1)
                    Text(PartyFormat.cardDate(party.eventDate, allDay: party.isAllDay ?? false))
                        .font(.caption.weight(.medium))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .glassEffect(.regular, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
                .padding(8)
            }
            .foregroundStyle(Color(.label))
            .contentShape(RoundedRectangle(cornerRadius: 32, style: .continuous))
            .dynamicTypeSize(...DynamicTypeSize.xxLarge)
            .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private var badgeView: some View {
        switch badge {
        case .days:
            Text("\(PartyFormat.daysUntil(party.eventDate))")
                .font(.subheadline.weight(.bold))
                .frame(width: 34, height: 34)
                .glassEffect(.regular, in: Circle())
                .accessibilityLabel("in \(PartyFormat.daysUntil(party.eventDate)) Tagen")
        case .status:
            Image(systemName: statusIcon)
                .font(.subheadline.weight(.bold))
                .frame(width: 34, height: 34)
                .glassEffect(.regular, in: Circle())
        case .none:
            EmptyView()
        }
    }

    /// ✓ zugesagt, ? vielleicht, ✗ abgesagt, Uhr bei offener Anfrage.
    private var statusIcon: String {
        switch party.myStatus {
        case "going": "checkmark"
        case "maybe": "questionmark"
        case "not_going": "xmark"
        default: "clock"
        }
    }
}

#if DEBUG
extension PartySummary {
    static func samples() -> [PartySummary] {
        let json = """
        [{"id":"00000000-0000-4000-8000-000000000011","title":"Davids Hausparty","background_url":"/backgrounds/bg-2.jpg","event_date":"2026-11-23T17:00:00+00:00","ends_at":null,"is_public":true,"host_id":"00000000-0000-4000-8000-000000000002","host_firstname":"David","host_lastname":"M","host_avatar_url":null,"host_avatar_color":"#1E5CFF","lat":51.3,"lng":12.3,"is_exact":true,"my_status":"going","category":"house","category_other":null,"is_all_day":false},
         {"id":"00000000-0000-4000-8000-000000000012","title":"Open-air Veltet","background_url":"/backgrounds/bg-3.jpg","event_date":"2026-11-26T19:00:00+00:00","ends_at":null,"is_public":false,"host_id":"00000000-0000-4000-8000-000000000003","host_firstname":"A","host_lastname":"B","host_avatar_url":null,"host_avatar_color":"#1E5CFF","lat":51.3,"lng":12.3,"is_exact":false,"my_status":"requested","category":"open_air","category_other":null,"is_all_day":false},
         {"id":"00000000-0000-4000-8000-000000000013","title":"Arthur's Geburtstag","background_url":"/backgrounds/bg-4.jpg","event_date":"2026-11-25T21:00:00+00:00","ends_at":null,"is_public":false,"host_id":"00000000-0000-4000-8000-000000000004","host_firstname":"Arthur","host_lastname":"Kunz","host_avatar_url":null,"host_avatar_color":"#1E5CFF","lat":51.3,"lng":12.3,"is_exact":true,"my_status":null,"category":"other","category_other":"Geburtstag","is_all_day":false}]
        """
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return (try? decoder.decode([PartySummary].self, from: Data(json.utf8))) ?? []
    }
}
#endif
