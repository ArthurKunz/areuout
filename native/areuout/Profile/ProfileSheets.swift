import AuthenticationServices
import Supabase
import SwiftUI

/// Rahmen der Profil-Sheets aus den Mockups: Titel in der Mitte, ✗ links, Bestätigen rechts.
private struct ProfileSheetFrame<Content: View>: View {
    @Environment(\.dismiss) private var dismiss
    let title: String
    var confirm: (() -> Void)?
    var canConfirm = true
    var isBusy = false
    @ViewBuilder let content: Content

    var body: some View {
        NavigationStack {
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                .background(Color.appBackground)
                .navigationTitle(title)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button(role: .close) { dismiss() }
                    }
                    if let confirm {
                        ToolbarItem(placement: .confirmationAction) {
                            if isBusy {
                                ProgressView()
                            } else {
                                Button(role: .confirm, action: confirm)
                                    .disabled(!canConfirm)
                            }
                        }
                    }
                }
        }
    }
}

private func errorBinding(_ value: Binding<String?>) -> Binding<Bool> {
    Binding(get: { value.wrappedValue != nil }, set: { if !$0 { value.wrappedValue = nil } })
}

// MARK: Name

struct NameSheet: View {
    @Environment(ProfileStore.self) private var profile
    @Environment(\.dismiss) private var dismiss
    @State private var text = ""
    @State private var isBusy = false
    @State private var errorMessage: String?
    @FocusState private var isFocused: Bool

    var body: some View {
        ProfileSheetFrame(title: "Name", confirm: save, canConfirm: FullName.problem(in: text) == nil, isBusy: isBusy) {
            VStack(alignment: .leading, spacing: 8) {
                TextField("Vor- und Nachname", text: $text)
                    .textContentType(.name)
                    .submitLabel(.done)
                    .onSubmit(save)
                    .focused($isFocused)
                    .capsuleField()
                if let problem = FullName.problem(in: text), !text.isEmpty {
                    Text(problem).font(.footnote).foregroundStyle(.secondary).padding(.leading, 20)
                }
            }
            .padding(24)
        }
        .onAppear {
            text = profile.fullName
        }
        .focusSoon { isFocused = true }
        .alert("Das ging nicht", isPresented: errorBinding($errorMessage)) {
            Button("OK") {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private func save() {
        guard FullName.problem(in: text) == nil, !isBusy else { return }
        isBusy = true
        Task {
            defer { isBusy = false }
            do {
                try await profile.updateName(text)
                dismiss()
            } catch {
                errorMessage = "Dein Name konnte nicht gespeichert werden."
            }
        }
    }
}

// MARK: Password

struct PasswordSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var password = ""
    @State private var isBusy = false
    @State private var errorMessage: String?
    @FocusState private var focused: Bool?

    var body: some View {
        ProfileSheetFrame(
            title: "Password",
            confirm: save,
            canConfirm: PasswordRules.firstProblem(in: password) == nil,
            isBusy: isBusy
        ) {
            VStack(alignment: .leading, spacing: 8) {
                PasswordField(placeholder: "Neues Password", text: $password, contentType: .newPassword, focus: $focused, focusValue: true, onSubmit: save)
                if let problem = PasswordRules.firstProblem(in: password), !password.isEmpty {
                    Text(problem).font(.footnote).foregroundStyle(.secondary).padding(.leading, 20)
                }
            }
            .padding(24)
        }
        .focusSoon { focused = true }
        .alert("Das ging nicht", isPresented: errorBinding($errorMessage)) {
            Button("OK") {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private func save() {
        guard PasswordRules.firstProblem(in: password) == nil, !isBusy else { return }
        isBusy = true
        Task {
            defer { isBusy = false }
            do {
                try await AuthService.setPassword(password)
                dismiss()
            } catch {
                errorMessage = AuthService.message(for: error)
            }
        }
    }
}

// MARK: Blockierte Personen

struct BlockedSheet: View {
    nonisolated private struct BlockedUser: Decodable, Identifiable {
        let id: UUID
        let firstname: String?
        let lastname: String?
        let avatarURL: String?
        let avatarColor: String

        enum CodingKeys: String, CodingKey {
            case id, firstname, lastname
            case avatarURL = "avatar_url"
            case avatarColor = "avatar_color"
        }

        var name: String { [firstname, lastname].compactMap { $0 }.joined(separator: " ") }
    }

    @State private var people: [BlockedUser] = []
    @State private var isLoading = true
    @State private var errorMessage: String?

    var body: some View {
        ProfileSheetFrame(title: "Blockierte Personen") {
            Group {
                if isLoading {
                    ProgressView().padding(.top, 40)
                } else if people.isEmpty {
                    ContentUnavailableView("Niemand blockiert", systemImage: "person.crop.circle.badge.checkmark")
                } else {
                    List(people) { person in
                        HStack(spacing: 12) {
                            AvatarView(
                                url: person.avatarURL,
                                color: person.avatarColor,
                                initials: FullName.initials(first: person.firstname, last: person.lastname),
                                size: 32
                            )
                            Text(person.name)
                        }
                        .contextMenu {
                            Button("Entsperren", systemImage: "person.crop.circle.badge.checkmark") {
                                Task { await unblock(person) }
                            }
                        }
                    }
                    .listStyle(.insetGrouped)
                    .scrollContentBackground(.hidden)
                }
            }
        }
        .task { await load() }
        .alert("Das ging nicht", isPresented: errorBinding($errorMessage)) {
            Button("OK") {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private func load() async {
        defer { isLoading = false }
        do {
            people = try await supabase.rpc("get_my_blocked_users").execute().value
        } catch {
            errorMessage = "Die Liste konnte nicht geladen werden."
        }
    }

    private func unblock(_ person: BlockedUser) async {
        do {
            try await supabase.rpc("unblock_user", params: ["p_user_id": person.id]).execute()
            withAnimation { people.removeAll { $0.id == person.id } }
        } catch {
            errorMessage = "\(person.name) konnte nicht entsperrt werden."
        }
    }
}

// MARK: Account verwalten

struct AccountSheet: View {
    @Environment(AuthModel.self) private var auth
    @Environment(ProfileStore.self) private var profile
    @State private var askDelete = false
    @State private var askDeleteWithoutApple = false
    @State private var isBusy = false
    @State private var errorMessage: String?

    var body: some View {
        ProfileSheetFrame(title: "Account verwalten") {
            List {
                Button("Ausloggen") {
                    Task { await auth.signOut() }
                }
                .foregroundStyle(.primary)
                Button("Account Löschen", role: .destructive) {
                    askDelete = true
                }
                .foregroundStyle(Color.appDestructive)
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .disabled(isBusy)
            .overlay { if isBusy { ProgressView().controlSize(.large) } }
        }
        .confirmationDialog(deleteQuestion, isPresented: $askDelete, titleVisibility: .visible) {
            Button("Account löschen", role: .destructive) { Task { await startDelete() } }
            Button("Abbrechen", role: .cancel) {}
        }
        .confirmationDialog(
            "Bei Apple hat das gerade nicht geklappt. Trotzdem löschen? Die Anmeldung mit Apple kannst du danach selbst in den iPhone-Einstellungen unter „Mit Apple anmelden“ beenden.",
            isPresented: $askDeleteWithoutApple,
            titleVisibility: .visible
        ) {
            Button("Trotzdem löschen", role: .destructive) { Task { await finishDelete() } }
            Button("Abbrechen", role: .cancel) {}
        }
        .alert("Das ging nicht", isPresented: errorBinding($errorMessage)) {
            Button("OK") {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    /// Dieselben Sätze wie MeAccountScreen der Web-App.
    private var deleteQuestion: String {
        let question = "Account wirklich löschen? Alle deine Partys und Antworten gehen verloren."
        guard profile.usesApple else { return question }
        return question + "\n\nDanach bestätigst du einmal mit Apple, damit areuout auch dort abgemeldet wird."
    }

    /// Apple-Konten bestätigen einmal mit Apple; der Code geht an die Edge Function
    /// revoke-apple, die die Anmeldung bei Apple beendet (App Store 5.1.1(v)).
    private func startDelete() async {
        guard profile.usesApple else { return await finishDelete() }
        isBusy = true
        do {
            let credential = try await AppleAuthorization.request(scopes: [], nonceHashed: AuthService.makeNonce().hashed)
            guard let data = credential.authorizationCode, let code = String(data: data, encoding: .utf8) else {
                throw AuthFailure("Apple hat keinen Code geschickt.")
            }
            try await supabase.functions.invoke("revoke-apple", options: FunctionInvokeOptions(body: ["code": code]))
            await finishDelete()
        } catch {
            isBusy = false
            // Apple-Fenster geschlossen: nichts löschen, nichts sagen.
            if (error as? ASAuthorizationError)?.code == .canceled { return }
            askDeleteWithoutApple = true
        }
    }

    /// Erst die Bilder, dann das Konto: danach darf niemand mehr an die Dateien
    /// (die Storage-Regeln prüfen auth.uid()), und delete_self verweigert, solange welche da sind.
    private func finishDelete() async {
        guard let userID = profile.userID?.uuidString.lowercased() else { return }
        isBusy = true
        defer { isBusy = false }
        try? await AvatarStorage.removeFolder(bucket: "avatars", prefix: userID)
        try? await AvatarStorage.removeFolder(bucket: "event-backgrounds", prefix: userID)
        do {
            try await supabase.rpc("delete_self").execute()
            await auth.signOut()
        } catch {
            errorMessage = "Dein Account konnte nicht gelöscht werden."
        }
    }
}

// MARK: Rechtliches

/// Die drei Rechtstexte in unserem Design. Die Wörter kommen von der Website
/// (app/legal/[doc]/route.ts), damit sie nie älter sind als dort.
struct LegalSheet: View {
    fileprivate struct Page: Hashable, Identifiable {
        let title: String
        let slug: String
        var id: String { slug }
    }

    private let pages = [
        Page(title: "Impressum", slug: "impressum"),
        Page(title: "Datenschutzerklärung", slug: "datenschutz"),
        Page(title: "Nutzungsbedingungen", slug: "nutzungsbedingungen"),
    ]

    var body: some View {
        ProfileSheetFrame(title: "Rechtliches") {
            List(pages) { page in
                NavigationLink(value: page) {
                    Text(page.title).foregroundStyle(Color(.label))
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .navigationDestination(for: Page.self) { page in
                LegalDocumentView(slug: page.slug, fallbackTitle: page.title)
            }
        }
    }
}

nonisolated private struct LegalDocument: Decodable {
    struct Section: Decodable {
        let heading: String?
        let paragraphs: [String]
    }

    let title: String
    let updated: String
    let sections: [Section]
}

private struct LegalDocumentView: View {
    let slug: String
    let fallbackTitle: String

    @State private var document: LegalDocument?
    @State private var failed = false

    var body: some View {
        Group {
            if let document {
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Stand: \(document.updated)")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity)
                        ForEach(Array(document.sections.enumerated()), id: \.offset) { _, section in
                            VStack(alignment: .leading, spacing: 8) {
                                if let heading = section.heading {
                                    Text(verbatim: heading)
                                        .font(.headline)
                                }
                                ForEach(Array(section.paragraphs.enumerated()), id: \.offset) { _, paragraph in
                                    Text(verbatim: paragraph)
                                        .font(.subheadline)
                                        .foregroundStyle(Color(.label))
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(16)
                            .background(Color.appSurface, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
                            .textSelection(.enabled)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 24)
                }
            } else if failed {
                ContentUnavailableView {
                    Label("Nicht geladen", systemImage: "wifi.exclamationmark")
                } description: {
                    Text("Der Text konnte nicht geladen werden. Prüf deine Verbindung.")
                } actions: {
                    Button("Nochmal versuchen") { Task { await load() } }
                }
            } else {
                ProgressView()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.appBackground)
        .navigationTitle(document?.title ?? fallbackTitle)
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func load() async {
        failed = false
        let url = AppConfig.websiteURL.appending(path: "legal/\(slug)")
        do {
            let (data, response) = try await URLSession.shared.data(from: url)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
            document = try JSONDecoder().decode(LegalDocument.self, from: data)
        } catch {
            failed = true
        }
    }
}
