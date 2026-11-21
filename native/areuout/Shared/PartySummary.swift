import CoreLocation
import Foundation

/// Eine Party, wie die Listen-Funktionen sie liefern (get_explore_parties, get_my_parties,
/// get_hosting_parties). Bei einer privaten Party ohne Zugang sind lat/lng schon auf dem
/// Server die verwischte Position (is_exact = false); die genaue kommt nie aufs Gerät.
nonisolated struct PartySummary: Decodable, Identifiable, Hashable {
    let id: UUID
    let title: String
    let backgroundURL: String?
    let eventDate: Date
    let endsAt: Date?
    let isPublic: Bool
    let hostID: UUID
    let hostFirstname: String?
    let hostLastname: String?
    let hostAvatarURL: String?
    let hostAvatarColor: String?
    let lat: Double
    let lng: Double
    let isExact: Bool
    /// going, maybe, not_going, requested oder nil.
    let myStatus: String?
    let category: String?
    let categoryOther: String?
    let isAllDay: Bool?

    enum CodingKeys: String, CodingKey {
        case id, title, lat, lng, category
        case backgroundURL = "background_url"
        case eventDate = "event_date"
        case endsAt = "ends_at"
        case isPublic = "is_public"
        case hostID = "host_id"
        case hostFirstname = "host_firstname"
        case hostLastname = "host_lastname"
        case hostAvatarURL = "host_avatar_url"
        case hostAvatarColor = "host_avatar_color"
        case isExact = "is_exact"
        case myStatus = "my_status"
        case categoryOther = "category_other"
        case isAllDay = "is_all_day"
    }

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }

    /// Das Partybild als volle Adresse. Die Vorlagen liegen auf der Website (/backgrounds/…),
    /// eigene Bilder im Supabase-Storage.
    var imageURL: URL? {
        guard let backgroundURL else { return nil }
        if backgroundURL.hasPrefix("/") {
            return AppConfig.websiteURL.appending(path: String(backgroundURL.dropFirst()))
        }
        return URL(string: backgroundURL)
    }
}
