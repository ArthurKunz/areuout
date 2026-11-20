import Supabase
import SwiftUI
import UIKit

/// Vor- und Nachname aus einem Feld: alles vor dem ersten Leerzeichen ist der Vorname,
/// der Rest der Nachname (wie Onboarding und Profil der Web-App).
enum FullName {
    static let partMax = 20

    static func split(_ text: String) -> (first: String, last: String) {
        let trimmed = text.trimmingCharacters(in: .whitespaces)
        guard let space = trimmed.firstIndex(of: " ") else { return (trimmed, "") }
        return (String(trimmed[..<space]), trimmed[space...].trimmingCharacters(in: .whitespaces))
    }

    /// Ein Satz für den Nutzer, oder nil, wenn der Name passt.
    static func problem(in text: String) -> String? {
        let parts = split(text)
        if parts.first.isEmpty { return "Gib deinen Namen ein." }
        if parts.first.count > partMax || parts.last.count > partMax {
            return "Vor- und Nachname höchstens je \(partMax) Zeichen."
        }
        return nil
    }

    static func initials(first: String?, last: String?) -> String {
        [first?.first, last?.first].compactMap { $0 }.map { String($0).uppercased() }.joined()
    }
}

/// Profilbilder im Bucket `avatars`, Pfad `{user}/avatar-{ms}.jpg` wie in der Web-App.
enum AvatarStorage {
    static let bucket = "avatars"

    /// Lädt das Bild neu gezeichnet hoch (ohne Standort und Gerät) und gibt die öffentliche URL zurück.
    static func upload(_ image: UIImage, userID: UUID) async throws -> String {
        guard let jpeg = image.avatarJPEG() else {
            throw AuthFailure("Dieses Bild konnte nicht verarbeitet werden. Versuch es mit einem anderen.")
        }
        let path = "\(userID.uuidString.lowercased())/avatar-\(Int(Date().timeIntervalSince1970 * 1000)).jpg"
        let files = supabase.storage.from(bucket)
        try await files.upload(path, data: jpeg, options: FileOptions(cacheControl: "3600", contentType: "image/jpeg", upsert: false))
        return try files.getPublicURL(path: path).absoluteString
    }

    /// Die alte Datei zu einer gespeicherten URL. Alles, was nicht in diesen Bucket zeigt, bleibt.
    static func remove(publicURL: String?) async {
        guard let path = publicURL?.components(separatedBy: "/\(bucket)/").dropFirst().first, !path.isEmpty else { return }
        _ = try? await supabase.storage.from(bucket).remove(paths: [path])
    }

    /// Einen ganzen Ordner leeren, auch Unterordner (wie removeStorageFolder in lib/storage.ts).
    static func removeFolder(bucket: String, prefix: String) async throws {
        let entries = try await supabase.storage.from(bucket).list(path: prefix)
        let files = entries.filter { $0.id != nil }.map { "\(prefix)/\($0.name)" }
        if !files.isEmpty { _ = try await supabase.storage.from(bucket).remove(paths: files) }
        for folder in entries where folder.id == nil {
            try await removeFolder(bucket: bucket, prefix: "\(prefix)/\(folder.name)")
        }
    }
}

extension UIImage {
    /// Höchstens 512 px an der längsten Kante (wie AVATAR_MAX_EDGE der Web-App), als JPEG.
    func avatarJPEG(maxEdge: CGFloat = 512) -> Data? {
        let scale = min(1, maxEdge / max(size.width, size.height))
        let target = CGSize(width: (size.width * scale).rounded(), height: (size.height * scale).rounded())
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let redrawn = UIGraphicsImageRenderer(size: target, format: format).image { _ in
            draw(in: CGRect(origin: .zero, size: target))
        }
        return redrawn.jpegData(compressionQuality: 0.85)
    }
}

/// Rundes Profilbild: Foto, sonst Initialen auf der Farbe.
struct AvatarView: View {
    let url: String?
    let color: String
    let initials: String
    let size: CGFloat

    var body: some View {
        ZStack {
            Circle().fill(Color(hexString: color))
            Text(initials)
                .font(.system(size: size * 0.34, weight: .semibold))
                .foregroundStyle(.white)
            if let url, let parsed = URL(string: url) {
                AsyncImage(url: parsed) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Color.clear
                }
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
    }
}
