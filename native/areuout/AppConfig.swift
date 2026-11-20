import Foundation

/// Werte aus Info.plist, die dort über Local.xcconfig landen (siehe Local.xcconfig.example).
enum AppConfig {
    static let supabaseURL: URL = {
        guard let host = Bundle.main.object(forInfoDictionaryKey: "SupabaseHost") as? String,
              !host.isEmpty, !host.hasPrefix("$("),
              let url = URL(string: "https://\(host)") else {
            fatalError("SupabaseHost fehlt: native/Local.xcconfig anlegen (Vorlage: Local.xcconfig.example)")
        }
        return url
    }()

    static let supabaseAnonKey: String = {
        guard let key = Bundle.main.object(forInfoDictionaryKey: "SupabaseAnonKey") as? String,
              !key.isEmpty, !key.hasPrefix("$(") else {
            fatalError("SupabaseAnonKey fehlt: native/Local.xcconfig anlegen (Vorlage: Local.xcconfig.example)")
        }
        return key
    }()
}
