import GoogleSignIn
import SwiftUI

@main
struct AreuoutApp: App {
    @State private var links = DeepLinkRouter()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(links)
                .onOpenURL { url in
                    // Links zu areuout öffnen eine Party; alles andere ist Googles Rückweg nach dem Login.
                    if !links.handle(url) {
                        GIDSignIn.sharedInstance.handle(url)
                    }
                }
        }
    }
}
