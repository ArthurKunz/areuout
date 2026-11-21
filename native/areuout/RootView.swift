import SwiftUI

/// Entscheidet, was die App zeigt: Start und Login, Onboarding oder die App selbst.
struct RootView: View {
    @State private var auth = AuthModel()

    var body: some View {
        #if DEBUG
        // Nur im Simulator zum Ansehen der Oberfläche ohne Login: Startargument -uiPreviewTabs.
        if ProcessInfo.processInfo.arguments.contains("-uiPreviewTabs") {
            MainTabView().environment(auth)
        } else if ProcessInfo.processInfo.arguments.contains("-uiPreviewParties") {
            PartiesView(openProfile: {}, sample: PartySummary.samples())
                .environment(ProfileStore())
                .environment(PartyFeed())
        } else if ProcessInfo.processInfo.arguments.contains("-uiPreviewDetail") {
            PartyDetailView(model: .sample()).environment(ProfileStore())
        } else {
            content
        }
        #else
        content
        #endif
    }

    private var content: some View {
        Group {
            switch auth.phase {
            case .loading:
                ProgressView()
            case .signedOut, .onboarding:
                WelcomeView()
            case .signedIn:
                MainTabView()
            case .failed(let message):
                VStack(spacing: 16) {
                    Text(message)
                        .multilineTextAlignment(.center)
                    Button("Nochmal versuchen") { Task { await auth.refresh() } }
                }
                .padding(24)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.appBackground)
        .environment(auth)
        .task { await auth.start() }
    }
}

#Preview {
    RootView()
}
