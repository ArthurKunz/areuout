import PhotosUI
import SwiftUI

/// Profil-Tab (Native Redesign 5.4): Bild mit Stift, Name, eine Liste mit Sheets.
struct ProfileView: View {
    enum Sheet: String, Identifiable {
        case name, password, blocked, account, legal, admin
        var id: String { rawValue }
    }

    @Environment(ProfileStore.self) private var profile
    @State private var sheet: Sheet?
    @State private var photoItem: PhotosPickerItem?
    @State private var isUploading = false
    @State private var errorMessage: String?

    var body: some View {
        List {
            Section {
                header
            }
            .listRowBackground(Color.clear)
            .listRowInsets(EdgeInsets())

            Section {
                row("Name", sheet: .name)
                if profile.hasPassword {
                    row("Password", sheet: .password)
                }
                row("Blockierte Personen", sheet: .blocked)
                row("Account verwalten", sheet: .account)
                row("Rechtliches", sheet: .legal)
                if profile.isAdmin {
                    row("Neue Events", sheet: .admin)
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Color.appBackground)
        .sheet(item: $sheet) { sheet in
            switch sheet {
            case .name: NameSheet()
            case .password: PasswordSheet()
            case .blocked: BlockedSheet()
            case .account: AccountSheet()
            case .legal: LegalSheet()
            case .admin: AdminView()
            }
        }
        // Über die Mitteilung des Agents kann das vor dem Profil ankommen, darum auch isAdmin beobachten.
        .onChange(of: profile.showAdmin, initial: true) { openAdminIfAsked() }
        .onChange(of: profile.isAdmin) { openAdminIfAsked() }
        .onChange(of: photoItem) { _, item in
            Task { await changePicture(item) }
        }
        .alert("Das ging nicht", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
            Button("OK") {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private var header: some View {
        VStack(spacing: 16) {
            ZStack(alignment: .bottomTrailing) {
                AvatarView(
                    url: profile.profile?.avatarURL,
                    color: profile.profile?.avatarColor ?? "#C4C4C6",
                    initials: profile.initials,
                    size: 160
                )
                .overlay {
                    if isUploading { ProgressView().controlSize(.large) }
                }

                PhotosPicker(selection: $photoItem, matching: .images) {
                    // Color(.label) statt .primary: .primary nimmt in Knöpfen die Akzentfarbe an.
                    Image(systemName: "pencil")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(Color(.label))
                        .frame(width: 44, height: 44)
                        .glassEffect(.regular.tint(Color(hex: 0xD9D9D9)).interactive(), in: Circle())
                }
                .accessibilityLabel("Profilbild ändern")
                .disabled(isUploading)
            }

            Text(profile.fullName)
                .font(.title.bold())
                .foregroundStyle(Color(.label))
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 32)
        .padding(.bottom, 8)
    }

    private func row(_ title: String, sheet target: Sheet) -> some View {
        Button {
            sheet = target
        } label: {
            HStack {
                Text(title).foregroundStyle(Color(.label))
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Color(.label))
            }
        }
    }

    private func openAdminIfAsked() {
        if profile.showAdmin, profile.isAdmin {
            sheet = .admin
            profile.showAdmin = false
        }
    }

    private func changePicture(_ item: PhotosPickerItem?) async {
        guard let item else { return }
        defer { photoItem = nil }
        guard let data = try? await item.loadTransferable(type: Data.self), let image = UIImage(data: data) else {
            errorMessage = "Dieses Bild konnte nicht geladen werden. Versuch es mit einem anderen."
            return
        }
        isUploading = true
        defer { isUploading = false }
        do {
            try await profile.updatePicture(image)
        } catch {
            errorMessage = AuthService.message(for: error)
        }
    }
}
