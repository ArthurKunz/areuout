import AuthenticationServices
import SwiftUI

/// Startseite (Native Redesign 5.1): Apple, Google oder E-Mail. Apple und Google melden
/// direkt an, egal ob das Konto neu ist oder nicht.
struct WelcomeView: View {
    @Environment(AuthModel.self) private var auth
    @State private var showEmail = false
    @State private var appleNonce = ""
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

                SignInWithAppleButton(.continue) { request in
                    let nonce = AuthService.makeNonce()
                    appleNonce = nonce.raw
                    request.requestedScopes = [.fullName, .email]
                    request.nonce = nonce.hashed
                } onCompletion: { result in
                    Task { await finishApple(result) }
                }
                .signInWithAppleButtonStyle(.black)
                .frame(height: 52)
                .clipShape(Capsule())

                Button {
                    Task { await signInWithGoogle() }
                } label: {
                    HStack(spacing: 8) {
                        Image("GoogleLogo")
                            .resizable()
                            .frame(width: 18, height: 18)
                        Text("Weiter mit Google")
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .buttonBorderShape(.capsule)
                .controlSize(.extraLarge)
                .tint(Color.appPrimaryButton)

                Button {
                    showEmail = true
                } label: {
                    Text("Weiter mit Email")
                        .foregroundStyle(.black)
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .buttonBorderShape(.capsule)
                .controlSize(.extraLarge)
                .tint(Color.appSeparator)

                Text("Mit „Google“ oder „Apple“ stimmst du den [Nutzungsbedingungen](https://www.areuout.de/nutzungsbedingungen) und der [Datenschutzerklärung](https://www.areuout.de/datenschutz) zu.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
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

    private func finishApple(_ result: Result<ASAuthorization, Error>) async {
        switch result {
        case .success(let authorization):
            guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential else { return }
            do {
                try await AuthService.signInWithApple(credential: credential, rawNonce: appleNonce)
            } catch {
                show(error)
            }
        case .failure(let error):
            if (error as? ASAuthorizationError)?.code == .canceled { return }
            show(error)
        }
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
