import Foundation
import Supabase

/// Der eine Supabase-Client der App. Nur der öffentliche Schlüssel, nie der Service-Role-Key.
/// emitLocalSessionAsInitialSession: die gespeicherte Sitzung kommt sofort als erstes Ereignis,
/// auch wenn sie abgelaufen ist; der Client erneuert sie vor der ersten Anfrage selbst.
let supabase = SupabaseClient(
    supabaseURL: AppConfig.supabaseURL,
    supabaseKey: AppConfig.supabaseAnonKey,
    options: SupabaseClientOptions(auth: .init(emitLocalSessionAsInitialSession: true))
)
