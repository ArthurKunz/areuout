import Supabase
import UIKit
import UserNotifications

/// Push-Mitteilungen wie in der Web-App (features/push/push.service.ts): dieselbe Tabelle
/// push_tokens über register_push_token, dieselbe Edge Function send-push. Der Server
/// schickt erst an Apples Produktions-, dann an den Testserver, darum klappt es auch in
/// Testversionen aus Xcode.
@MainActor
final class PushManager: NSObject {
    static let shared = PushManager()

    /// Das Token dieses Geräts, sobald iOS es geliefert hat. Nur im Speicher, nie geloggt.
    private var token: String?

    /// Nach einer Anfrage, einer Zusage oder einer neuen Party: einmal fragen. iOS zeigt den
    /// Dialog nur ein einziges Mal; nach einem Nein fragt die App nie wieder.
    func ask() {
        Task {
            let center = UNUserNotificationCenter.current()
            let settings = await center.notificationSettings()
            switch settings.authorizationStatus {
            case .notDetermined:
                let granted = (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
                if granted { UIApplication.shared.registerForRemoteNotifications() }
            case .authorized, .provisional, .ephemeral:
                UIApplication.shared.registerForRemoteNotifications()
            default:
                break
            }
        }
    }

    /// Beim Start und nach dem Login, nur wenn schon erlaubt: Token auffrischen und dem
    /// eingeloggten Konto zuordnen. Nie ein Dialog.
    func refresh() {
        Task {
            let settings = await UNUserNotificationCenter.current().notificationSettings()
            if [.authorized, .provisional, .ephemeral].contains(settings.authorizationStatus) {
                UIApplication.shared.registerForRemoteNotifications()
            }
        }
    }

    /// Von iOS: das Token als Kleinbuchstaben-Hex, wie push_tokens es speichert.
    func didRegister(deviceToken: Data) {
        let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
        token = hex
        Task {
            guard (try? await supabase.auth.session) != nil else { return }
            _ = try? await supabase.rpc("register_push_token", params: ["p_token": hex]).execute()
        }
    }

    /// Vor dem Ausloggen, solange die Sitzung das Löschen noch erlaubt. Nur dieses Gerät.
    func forgetThisDevice() async {
        guard let token else { return }
        _ = try? await supabase.from("push_tokens").delete(returning: .minimal).eq("token", value: token).execute()
    }
}

/// Nimmt Token und Tipps auf Mitteilungen von iOS entgegen.
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        PushManager.shared.didRegister(deviceToken: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        // Ohne Token gibt es keine Mitteilungen; die App läuft trotzdem.
    }

    /// Auch wenn die App offen ist, als Banner zeigen.
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .sound]
    }

    /// Tipp auf eine Mitteilung: event_id öffnet die Party, path `/admin` den Admin-Bereich.
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        let info = response.notification.request.content.userInfo
        let eventID = (info["event_id"] as? String).flatMap(UUID.init(uuidString:))
        let path = info["path"] as? String
        await MainActor.run {
            if let eventID {
                DeepLinkRouter.shared.pending = .party(eventID)
            } else if path == "/admin" {
                DeepLinkRouter.shared.pending = .admin
            }
        }
    }
}
