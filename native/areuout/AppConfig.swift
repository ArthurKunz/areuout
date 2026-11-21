import Foundation

/// Werte aus Info.plist, die dort über Local.xcconfig landen (siehe Local.xcconfig.example).
nonisolated enum AppConfig {
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

    /// Die Website, von der die App Rechtstexte lädt. In Testversionen lässt sie sich mit dem
    /// Startargument -websiteURL umstellen, etwa auf einen lokalen Server.
    static let websiteURL: URL = {
        #if DEBUG
        if let index = ProcessInfo.processInfo.arguments.firstIndex(of: "-websiteURL"),
           index + 1 < ProcessInfo.processInfo.arguments.count,
           let url = URL(string: ProcessInfo.processInfo.arguments[index + 1]) {
            return url
        }
        #endif
        return URL(string: "https://www.areuout.de")!
    }()
}
