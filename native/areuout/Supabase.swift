import Foundation
import Supabase

/// Der eine Supabase-Client der App. Nur der öffentliche Schlüssel, nie der Service-Role-Key.
let supabase = SupabaseClient(supabaseURL: AppConfig.supabaseURL, supabaseKey: AppConfig.supabaseAnonKey)

/// Prüft nur, ob der Auth-Server antwortet. Für den Platzhalter aus Schritt 1.
enum SupabaseHealth {
    static func check() async -> String {
        var request = URLRequest(url: AppConfig.supabaseURL.appending(path: "auth/v1/health"))
        request.setValue(AppConfig.supabaseAnonKey, forHTTPHeaderField: "apikey")
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            let code = (response as? HTTPURLResponse)?.statusCode ?? 0
            return code == 200 ? "Supabase erreichbar" : "Supabase antwortet mit \(code)"
        } catch {
            return "Keine Verbindung: \(error.localizedDescription)"
        }
    }
}
