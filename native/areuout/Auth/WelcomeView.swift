import AuthenticationServices
import SwiftUI

/// Startseite (Native Redesign 5.1): Apple, Google oder E-Mail. Apple und Google melden
/// direkt an, egal ob das Konto neu ist oder nicht.
struct WelcomeView: View {
    @Environment(AuthModel.self) private var auth
    @State private var showEmail = false
    @State private var errorMessage: String?

    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()
            BackgroundShapes()

            VStack(spacing: 12) {
                Spacer()

                VStack(spacing: 0) {
                    Text("Willkommen bei")
                        .font(.title2.bold())
                    Text("areuout")
                        .font(.system(size: 44, weight: .bold))
                }
                .padding(.bottom, 20)

                // Apple und Google mit demselben Knopf-Stil, damit Schrift und Größe gleich sind
                // (Arthur, 2026-11-22). Apple erlaubt einen eigenen Knopf mit seinem Logo.
                WelcomeButton(title: "Mit Apple fortfahren", tint: .black, foreground: .white) {
                    Image(systemName: "apple.logo").font(.system(size: 18, weight: .medium))
                } action: {
                    Task { await signInWithApple() }
                }

                WelcomeButton(title: "Mit Google fortfahren", tint: .appPrimaryButton, foreground: .white) {
                    Image("GoogleLogo").resizable().frame(width: 18, height: 18)
                } action: {
                    Task { await signInWithGoogle() }
                }

                WelcomeButton(title: "Weiter mit Email", tint: .appSeparator, foreground: .black) {
                    EmptyView()
                } action: {
                    showEmail = true
                }

                Text(Self.consentText)
                    .font(.caption2)
                    .foregroundStyle(Color(.secondaryLabel))
                    .tint(Color(.secondaryLabel))
                    .multilineTextAlignment(.center)
                    .padding(.top, 4)
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 8)
        }
        .sheet(isPresented: sheetBinding) {
            Group {
                if auth.phase == .onboarding {
                    OnboardingView()
                } else {
                    EmailFlowView { showEmail = false }
                }
            }
            .interactiveDismissDisabled(auth.phase == .onboarding)
        }
        .alert("Das ging nicht", isPresented: errorBinding) {
            Button("OK") {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    /// Ein Sheet für beides: der E-Mail-Weg und danach das Onboarding. So muss kein Sheet
    /// geschlossen und ein anderes geöffnet werden.
    private var sheetBinding: Binding<Bool> {
        Binding(
            get: { showEmail || auth.phase == .onboarding },
            set: { if !$0 { showEmail = false } }
        )
    }

    private var errorBinding: Binding<Bool> {
        Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })
    }

    private func signInWithApple() async {
        let nonce = AuthService.makeNonce()
        do {
            let credential = try await AppleAuthorization.request(scopes: [.fullName, .email], nonceHashed: nonce.hashed)
            try await AuthService.signInWithApple(credential: credential, rawNonce: nonce.raw)
        } catch {
            if (error as? ASAuthorizationError)?.code == .canceled { return }
            show(error)
        }
    }

    /// Die Zustimmung unten: Links in demselben Grau wie der Text, nur unterstrichen.
    private static var consentText: AttributedString {
        var text = (try? AttributedString(markdown: "Mit „Google“ oder „Apple“ stimmst du den [Nutzungsbedingungen](https://www.areuout.de/nutzungsbedingungen) und der [Datenschutzerklärung](https://www.areuout.de/datenschutz) zu.")) ?? AttributedString()
        for run in text.runs where run.link != nil {
            text[run.range].underlineStyle = .single
        }
        return text
    }

    private func signInWithGoogle() async {
        do {
            try await AuthService.signInWithGoogle()
        } catch {
            show(error)
        }
    }

    private func show(_ error: Error) {
        let message = AuthService.message(for: error)
        if !message.isEmpty { errorMessage = message }
    }
}

/// Die hellen, gedrehten Flächen im Hintergrund der Startseite (Mockup).
private struct BackgroundShapes: View {
    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            ZStack {
                shape(size: 200).position(x: w * 0.95, y: h * 0.12)
                shape(size: 230).position(x: w * 0.12, y: h * 0.32)
                shape(size: 170).position(x: w * 0.95, y: h * 0.52)
                shape(size: 170).position(x: w * 0.0, y: h * 0.98)
            }
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
    }

    private func shape(size: CGFloat) -> some View {
        RoundedRectangle(cornerRadius: size * 0.22, style: .continuous)
            .fill(Color.black.opacity(0.035))
            .frame(width: size, height: size)
            .rotationEffect(.degrees(-20))
    }
}

/// Ein Knopf der Startseite: gleiche Form, Höhe und Schrift für Apple, Google und E-Mail.
private struct WelcomeButton<Icon: View>: View {
    let title: String
    let tint: Color
    let foreground: Color
    @ViewBuilder let icon: Icon
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                icon
                Text(title)
            }
            .font(.body.weight(.semibold))
            .foregroundStyle(foreground)
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
        .buttonBorderShape(.capsule)
        .controlSize(.extraLarge)
        .tint(tint)
    }
}
