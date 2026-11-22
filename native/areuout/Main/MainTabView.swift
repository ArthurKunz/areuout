import SwiftUI

/// Tab-Leiste (Native Redesign 4): Explore, Parties, Profile in einer Glas-Kapsel und rechts
/// davon abgesetzt der runde Plus-Knopf. Die System-Tab-Leiste kann den Knopf in dieser
/// iOS-Version nicht absetzen (auch nicht als Such-Tab, im Simulator geprüft), darum ist die
/// Leiste aus Apples Liquid-Glass-Bausteinen gebaut. Die Tabs selbst bleiben ein TabView.
struct MainTabView: View {
    enum TabID: CaseIterable {
        case explore, parties, profile

        var title: String {
            switch self {
            case .explore: "Explore"
            case .parties: "Parties"
            case .profile: "Profile"
            }
        }

        var icon: String {
            switch self {
            case .explore: "map"
            case .parties: "party.popper"
            case .profile: "person.crop.circle"
            }
        }
    }

    @State private var selection: TabID = .explore
    @State private var showCreate = false
    @State private var createdPartyID: UUID?
    @State private var linkedPartyID: UUID?
    @State private var linkMissing = false
    @Environment(DeepLinkRouter.self) private var links
    @State private var feed = PartyFeed()
    @State private var profile = ProfileStore()

    var body: some View {
        TabView(selection: $selection) {
            Tab(value: TabID.explore) {
                ExploreView().toolbarVisibility(.hidden, for: .tabBar)
            }
            Tab(value: TabID.parties) {
                PartiesView { selection = .profile }.toolbarVisibility(.hidden, for: .tabBar)
            }
            Tab(value: TabID.profile) {
                ProfileView().toolbarVisibility(.hidden, for: .tabBar)
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            BottomBar(selection: $selection) { showCreate = true }
        }
        .sheet(isPresented: $showCreate) {
            PartyFormView(mode: .create) { id in
                feed.changed()
                createdPartyID = id
            }
        }
        .sheet(item: $createdPartyID) { id in
            // Nach dem Erstellen gleich die neue Party zeigen (Teilen-Knopf bereit).
            PartyDetailView(partyID: id) { feed.changed() }
        }
        .sheet(item: $linkedPartyID) { id in
            PartyDetailView(partyID: id) { feed.changed() }
        }
        .task(id: links.pending) { await openLink() }
        .alert("Diese Party existiert nicht (mehr).", isPresented: $linkMissing) {
            Button("OK") {}
        }
        .environment(profile)
        .environment(feed)
        .task {
            await profile.load()
            PushManager.shared.refresh()
        }
    }
}

extension MainTabView {
    /// Einen wartenden Link öffnen, sobald die App eingeloggt ist.
    fileprivate func openLink() async {
        guard let target = links.pending else { return }
        links.pending = nil
        switch target {
        case .party(let id):
            // Ist genau diese Party schon offen, lädt sie über scenePhase neu.
            if linkedPartyID != id { linkedPartyID = id }
        case .admin:
            selection = .profile
            profile.showAdmin = true
        case .invite(let code):
            if let id = await DeepLinkRouter.resolveInvite(code) {
                feed.changed()
                linkedPartyID = id
            } else {
                linkMissing = true
            }
        }
    }
}

/// Die Glas-Kapsel mit den drei Tabs und der runde Plus-Knopf daneben.
private struct BottomBar: View {
    @Binding var selection: MainTabView.TabID
    let create: () -> Void

    var body: some View {
        GlassEffectContainer(spacing: 12) {
            HStack(spacing: 12) {
                HStack(spacing: 0) {
                    ForEach(MainTabView.TabID.allCases, id: \.self) { tab in
                        tabButton(tab)
                    }
                }
                .padding(4)
                .glassEffect(.regular.interactive(), in: Capsule())

                Button(action: create) {
                    Image(systemName: "plus")
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundStyle(.primary)
                        .frame(width: 62, height: 62)
                        .contentShape(Circle())
                }
                .buttonStyle(.plain)
                .glassEffect(.regular.interactive(), in: Circle())
                .accessibilityLabel("Party erstellen")
            }
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 4)
    }

    private func tabButton(_ tab: MainTabView.TabID) -> some View {
        let isSelected = selection == tab
        return Button {
            selection = tab
        } label: {
            VStack(spacing: 2) {
                Image(systemName: tab.icon)
                    .symbolVariant(isSelected ? .fill : .none)
                    .font(.system(size: 20, weight: .medium))
                    .frame(height: 26)
                Text(tab.title)
                    .font(.system(size: 10, weight: .semibold))
            }
            .foregroundStyle(isSelected ? Color.accentColor : Color.primary)
            .frame(maxWidth: .infinity)
            .frame(height: 54)
            .background {
                if isSelected { Capsule().fill(Color.black.opacity(0.07)) }
            }
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

// MARK: Platzhalter bis zu ihren Schritten

