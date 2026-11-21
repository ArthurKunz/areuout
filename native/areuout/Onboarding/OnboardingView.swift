import PhotosUI
import Supabase
import SwiftUI

/// Onboarding (Native Redesign 5.1): `Wie heißt du?`, dann `Und jetzt dein Profilbild?`.
/// Schreibt die profiles-Zeile wie die Web-App (features/onboarding).
struct OnboardingView: View {
    enum Step {
        case name
        case picture
    }

    @Environment(AuthModel.self) private var auth

    @State private var step: Step = .name
    @State private var fullName = ""
    @State private var photoItem: PhotosPickerItem?
    @State private var photo: UIImage?
    @State private var color: String?
    @State private var isBusy = false
    @State private var errorMessage: String?
    @FocusState private var isFocused: Bool

    /// Die sieben Punkte in der Reihenfolge des Mockups; Blau ist Elektroblau.
    private static let swatches = ["#F09343", "#EB4C46", "#5AC5B3", "#BB3ED9", "#DEB93E", "#65C466", "#1E5CFF"]

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                SheetTitle(text: step == .name ? "Wie heißt du?" : "Und jetzt dein Profilbild?")
                    .padding(.bottom, 8)
                switch step {
                case .name: nameStep
                case .picture: pictureStep
                }
                Spacer()
            }
            .padding(.horizontal, 24)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.appBackground)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    // Abbrechen heißt hier ausloggen: ohne Profil gibt es keine App.
                    Button(role: .close) { Task { await auth.signOut() } }
                }
            }
        }
        .onAppear {
            if fullName.isEmpty { fullName = auth.suggestedName }
            isFocused = true
        }
        .onChange(of: photoItem) { _, item in
            Task { await loadPhoto(item) }
        }
        .alert("Das ging nicht", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
            Button("OK") {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    // MARK: Name

    private var nameStep: some View {
        Group {
            TextField("Vor- und Nachname", text: $fullName)
                .textContentType(.name)
                .submitLabel(.continue)
                .onSubmit { if nameProblem == nil { goToPicture() } }
                .focused($isFocused)
                .capsuleField()
            if let problem = nameProblem, !fullName.trimmingCharacters(in: .whitespaces).isEmpty {
                Text(problem)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            PrimaryButton(title: "Weiter", isEnabled: nameProblem == nil, action: goToPicture)
        }
    }

    private var nameParts: (first: String, last: String) { FullName.split(fullName) }

    private var nameProblem: String? { FullName.problem(in: fullName) }

    private func goToPicture() {
        isFocused = false
        withAnimation { step = .picture }
    }

    // MARK: Profilbild

    private var pictureStep: some View {
        VStack(spacing: 20) {
            PhotosPicker(selection: $photoItem, matching: .images) {
                avatarCircle
            }
            .buttonStyle(.plain)

            HStack(spacing: 10) {
                ForEach(Self.swatches, id: \.self) { hex in
                    Button {
                        color = hex
                        photo = nil
                        photoItem = nil
                    } label: {
                        Circle()
                            .fill(Color(hexString: hex))
                            .frame(width: 30, height: 30)
                            .overlay {
                                if color == hex {
                                    Image(systemName: "checkmark")
                                        .font(.caption.bold())
                                        .foregroundStyle(.white)
                                }
                            }
                    }
                    .accessibilityLabel("Farbe \(hex)")
                }
            }

            PrimaryButton(title: "Weiter", isLoading: isBusy, action: save)
        }
    }

    @ViewBuilder
    private var avatarCircle: some View {
        let size: CGFloat = 130
        if let photo {
            Image(uiImage: photo)
                .resizable()
                .scaledToFill()
                .frame(width: size, height: size)
                .clipShape(Circle())
        } else if let color {
            Circle()
                .fill(Color(hexString: color))
                .frame(width: size, height: size)
                .overlay {
                    Text(initials)
                        .font(.system(size: 44, weight: .semibold))
                        .foregroundStyle(.white)
                }
        } else {
            Circle()
                .fill(Color.appSurface)
                .frame(width: size, height: size)
                .overlay {
                    Image(systemName: "photo.badge.arrow.down")
                        .font(.system(size: 40))
                        .foregroundStyle(Color.appPlaceholder)
                }
        }
    }

    private var initials: String { FullName.initials(first: nameParts.first, last: nameParts.last) }

    private func loadPhoto(_ item: PhotosPickerItem?) async {
        guard let item else { return }
        guard let data = try? await item.loadTransferable(type: Data.self), let image = UIImage(data: data) else {
            errorMessage = "Dieses Bild konnte nicht geladen werden. Versuch es mit einem anderen."
            return
        }
        photo = image
        color = nil
    }

    private func save() {
        guard !isBusy else { return }
        isBusy = true
        Task {
            defer { isBusy = false }
            do {
                let user = try await supabase.auth.session.user
                var avatarURL: String?
                if let photo {
                    avatarURL = try await AvatarStorage.upload(photo, userID: user.id)
                }
                // Ohne Wahl eine zufällige der sieben Farben, wie in der Web-App.
                let avatarColor = color ?? Self.swatches.randomElement() ?? "#1E5CFF"
                let parts = nameParts
                do {
                    try await supabase.from("profiles").insert(NewProfile(
                        id: user.id,
                        firstname: parts.first,
                        lastname: parts.last,
                        avatarURL: avatarURL,
                        avatarColor: avatarColor
                    )).execute()
                } catch let error as PostgrestError where error.code == "23505" {
                    // Die Zeile gibt es schon (zweiter Tipp): so lassen, nie überschreiben.
                }
                await auth.refresh()
            } catch {
                errorMessage = "Dein Profil konnte nicht gespeichert werden."
            }
        }
    }
}

nonisolated private struct NewProfile: Encodable {
    let id: UUID
    let firstname: String
    let lastname: String
    let avatarURL: String?
    let avatarColor: String

    enum CodingKeys: String, CodingKey {
        case id, firstname, lastname
        case avatarURL = "avatar_url"
        case avatarColor = "avatar_color"
    }
}
