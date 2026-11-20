import SwiftUI

/// Entscheidet, was die App zeigt: Start und Login, Onboarding oder die App selbst.
struct RootView: View {
    @State private var auth = AuthModel()

    var body: some View {
        Group {
            switch auth.phase {
            case .loading:
                ProgressView()
            case .signedOut, .onboarding:
                WelcomeView()
            case .signedIn:
                SignedInPlaceholder()
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

/// Platzhalter bis Schritt 3 (Tab-Leiste und Profil).
private struct SignedInPlaceholder: View {
    @Environment(AuthModel.self) private var auth

    var body: some View {
        VStack(spacing: 16) {
            Text("Du bist eingeloggt.")
                .font(.title3.bold())
            Button("Ausloggen") { Task { await auth.signOut() } }
        }
    }
}

#Preview {
    RootView()
}
