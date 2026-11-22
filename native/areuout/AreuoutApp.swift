import GoogleSignIn
import SwiftUI

@main
struct AreuoutApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var links = DeepLinkRouter.shared

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
