import SwiftUI

/// Der Weg über `Weiter mit Email` (Native Redesign 5.1): E-Mail, dann Passwort (Konto da)
/// oder Code und neues Passwort (neues Konto).
struct EmailFlowView: View {
    enum Step {
        case email
        case password
        case code
        case newPassword
    }

    @Environment(AuthModel.self) private var auth
    let onClose: () -> Void

    @State private var step: Step = .email
    @State private var email = ""
    @State private var password = ""
    @State private var code = ""
    @State private var newPassword = ""
    @State private var usesAppleOrGoogle = false
    @State private var isBusy = false
    @State private var errorMessage: String?
    @State private var notice: String?
    @FocusState private var focused: Step?

    private let codeLength = 6

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                SheetTitle(text: title)
                    .padding(.bottom, 8)
                content
                Spacer()
            }
            .padding(.horizontal, 24)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.appBackground)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(role: .close) { close() }
                }
            }
        }
        .focusSoon { focused = step }
        .alert("Das ging nicht", isPresented: binding(for: $errorMessage)) {
            Button("OK") {}
        } message: {
            Text(errorMessage ?? "")
        }
        .alert(notice ?? "", isPresented: binding(for: $notice)) {
            Button("OK") {}
        }
    }

    private var title: String {
        switch step {
        case .email: "Log in oder sign up"
        case .password: "Gib dein Password ein"
        case .code: "Schau in dein Postfach"
        case .newPassword: "Erstelle dein Password"
        }
    }

    @ViewBuilder
    private var content: some View {
        switch step {
        case .email:
            TextField("Email", text: $email)
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.continue)
                .onSubmit(submitEmail)
                .focused($focused, equals: .email)
                .capsuleField()
            PrimaryButton(title: "Weiter", isLoading: isBusy, isEnabled: isEmailPlausible, action: submitEmail)

        case .password:
            if usesAppleOrGoogle {
                Text("Dein Konto nutzt Apple oder Google. Melde dich damit an oder setz über „Passwort vergessen?“ ein Passwort.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            PasswordField(placeholder: "Password", text: $password, focus: $focused, focusValue: .password, onSubmit: submitPassword)
            PrimaryButton(title: "Weiter", isLoading: isBusy, isEnabled: !password.isEmpty, action: submitPassword)
            Button("Passwort vergessen?", action: sendReset)
                .font(.subheadline)
                .tint(.primary)
                .disabled(isBusy)

        case .code:
            TextField("Code", text: $code)
                .keyboardType(.numberPad)
                .textContentType(.oneTimeCode)
                .focused($focused, equals: .code)
                .capsuleField()
                .onChange(of: code) { _, value in
                    let digits = String(value.filter(\.isNumber).prefix(codeLength))
                    if digits != value { code = digits }
                    if digits.count == codeLength { submitCode() }
                }
            PrimaryButton(title: "Weiter", isLoading: isBusy, isEnabled: code.count == codeLength, action: submitCode)
            Button("erneut senden", action: resendCode)
                .font(.subheadline)
                .tint(.primary)
                .disabled(isBusy)

        case .newPassword:
            PasswordField(placeholder: "Password", text: $newPassword, contentType: .newPassword, focus: $focused, focusValue: .newPassword, onSubmit: submitNewPassword)
            if let problem = PasswordRules.firstProblem(in: newPassword), !newPassword.isEmpty {
                Text(problem)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            PrimaryButton(
                title: "Weiter",
                isLoading: isBusy,
                isEnabled: PasswordRules.firstProblem(in: newPassword) == nil,
                action: submitNewPassword
            )
        }
    }

    private var trimmedEmail: String { email.trimmingCharacters(in: .whitespacesAndNewlines) }

    private var isEmailPlausible: Bool {
        let parts = trimmedEmail.split(separator: "@")
        return parts.count == 2 && parts[1].contains(".")
    }

    // MARK: Schritte

    private func submitEmail() {
        guard isEmailPlausible, !isBusy else { return }
        run {
            switch try await AuthService.accountStatus(email: trimmedEmail) {
            case .password:
                usesAppleOrGoogle = false
                go(to: .password)
            case .noPassword:
                usesAppleOrGoogle = true
                go(to: .password)
            case .new:
                try await AuthService.startSignUp(email: trimmedEmail)
                go(to: .code)
            }
        }
    }

    private func submitPassword() {
        guard !password.isEmpty, !isBusy else { return }
        run {
            do {
                try await AuthService.signIn(email: trimmedEmail, password: password)
            } catch where AuthService.isEmailNotConfirmed(error) {
                // Registrierung früher abgebrochen: Code nochmal schicken, dann neues Passwort.
                try await AuthService.resendCode(email: trimmedEmail)
                go(to: .code)
            }
        }
    }

    private func submitCode() {
        guard code.count == codeLength, !isBusy else { return }
        run {
            auth.isSettingPassword = true
            do {
                try await AuthService.verifyCode(email: trimmedEmail, code: code)
                go(to: .newPassword)
            } catch {
                auth.isSettingPassword = false
                code = ""
                throw error
            }
        }
    }

    private func submitNewPassword() {
        guard PasswordRules.firstProblem(in: newPassword) == nil, !isBusy else { return }
        run {
            try await AuthService.setPassword(newPassword)
            auth.isSettingPassword = false
            await auth.refresh()
        }
    }

    private func resendCode() {
        run {
            try await AuthService.resendCode(email: trimmedEmail)
            notice = "Ein neuer Code ist unterwegs."
        }
    }

    private func sendReset() {
        run {
            try await AuthService.sendPasswordReset(email: trimmedEmail)
            notice = "Schau in dein Postfach. Über den Link setzt du ein neues Passwort."
        }
    }

    // MARK: Hilfen

    private func go(to next: Step) {
        withAnimation { step = next }
        // Das neue Feld entsteht erst mit dem Schritt; kurz warten, dann fokussieren.
        Task {
            try? await Task.sleep(for: .milliseconds(150))
            focused = next
        }
    }

    /// Ab dem Code ist das Konto angelegt und eingeloggt. Wer hier abbricht, wird
    /// ausgeloggt; das Konto bleibt und lässt sich über `Passwort vergessen?` weiter nutzen.
    private func close() {
        if auth.isSettingPassword || step == .newPassword {
            Task { await auth.signOut() }
        }
        onClose()
    }

    private func run(_ work: @escaping () async throws -> Void) {
        isBusy = true
        Task {
            defer { isBusy = false }
            do {
                try await work()
            } catch {
                let message = AuthService.message(for: error)
                if !message.isEmpty { errorMessage = message }
            }
        }
    }

    private func binding(for value: Binding<String?>) -> Binding<Bool> {
        Binding(get: { value.wrappedValue != nil }, set: { if !$0 { value.wrappedValue = nil } })
    }
}
