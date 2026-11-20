import SwiftUI

/// Platzhalter für Schritt 1 der Native Build Order: zeigt nur, dass die App startet
/// und Supabase erreicht. Wird in Schritt 2 (Login) ersetzt.
struct RootView: View {
    @State private var status = "Verbinde …"

    var body: some View {
        VStack(spacing: 12) {
            Text("areuout")
                .font(.largeTitle.bold())
            Text(status)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.appBackground)
        .task { status = await SupabaseHealth.check() }
    }
}

#Preview {
    RootView()
}
