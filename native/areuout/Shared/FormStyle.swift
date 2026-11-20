import SwiftUI

/// Die gemeinsamen Bausteine der Sheets aus den Mockups: weißes Kapselfeld, dunkler
/// `Weiter`-Knopf. Alles System-Komponenten, nur in Farbe und Form gesetzt.
extension View {
    func capsuleField() -> some View {
        padding(.horizontal, 20)
            .frame(minHeight: 50)
            .background(Color.appSurface, in: Capsule())
    }
}

struct PrimaryButton: View {
    let title: String
    var isLoading = false
    var isEnabled = true
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                Text(title).opacity(isLoading ? 0 : 1)
                if isLoading { ProgressView().tint(.white) }
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
        .buttonBorderShape(.capsule)
        .controlSize(.extraLarge)
        .tint(Color.appPrimaryButton)
        .disabled(!isEnabled || isLoading)
    }
}

/// Großer Titel in der Mitte eines Sheets, wie `Log in oder sign up`.
struct SheetTitle: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.title2.bold())
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
    }
}
