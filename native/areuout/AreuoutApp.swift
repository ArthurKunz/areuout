import GoogleSignIn
import SwiftUI

@main
struct AreuoutApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
                .onOpenURL { url in
                    // Google kommt nach dem Login über das URL-Schema zurück.
                    GIDSignIn.sharedInstance.handle(url)
                }
        }
    }
}
