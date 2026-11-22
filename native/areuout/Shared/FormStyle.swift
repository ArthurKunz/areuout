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
            // Der Kreisel liegt über dem Text statt daneben: so bleibt der Knopf beim Laden
            // genau so groß wie vorher (Arthur, 2026-11-22).
            Text(title)
                .opacity(isLoading ? 0 : 1)
                .frame(maxWidth: .infinity)
                .overlay {
                    if isLoading { ProgressView().controlSize(.regular).tint(.white) }
                }
        }
        .buttonStyle(.borderedProminent)
        .buttonBorderShape(.capsule)
        .controlSize(.extraLarge)
        .tint(Color.appPrimaryButton)
        .disabled(!isEnabled || isLoading)
    }
}

/// Passwortfeld mit Auge rechts: zeigt das Passwort an oder versteckt es wieder.
/// Der Fokus bleibt beim Umschalten im Feld.
struct PasswordField<Focus: Hashable>: View {
    let placeholder: String
    @Binding var text: String
    var contentType: UITextContentType = .password
    let focus: FocusState<Focus?>.Binding
    let focusValue: Focus
    var onSubmit: () -> Void = {}

    @State private var isVisible = false

    var body: some View {
        HStack(spacing: 12) {
            Group {
                if isVisible {
                    TextField(placeholder, text: $text)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                } else {
                    SecureField(placeholder, text: $text)
                }
            }
            .textContentType(contentType)
            .submitLabel(.go)
            .onSubmit(onSubmit)
            .focused(focus, equals: focusValue)

            Button {
                isVisible.toggle()
                focus.wrappedValue = focusValue
            } label: {
                Image(systemName: isVisible ? "eye.slash" : "eye")
                    .font(.system(size: 17))
                    .foregroundStyle(Color(.secondaryLabel))
                    .frame(width: 28, height: 28)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(isVisible ? "Passwort verstecken" : "Passwort anzeigen")
        }
        .capsuleField()
    }
}

extension View {
    /// Setzt den Fokus kurz nach dem Erscheinen. Direkt in `onAppear` greift er in Sheets oft
    /// nicht, weil das Sheet noch hereinfährt.
    func focusSoon(_ action: @escaping () -> Void) -> some View {
        task {
            try? await Task.sleep(for: .milliseconds(350))
            action()
        }
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
