import CoreLocation
import EventKit
import Foundation

/// Trägt eine Party in den Kalender ein (App 2.1, entschieden 2026-11-23). Nur Schreibzugriff:
/// die App sieht den Kalender nie. Eingetragen werden nur Titel, Zeit und Ort, und zwar genau
/// der Ort, den die Partyseite zeigt. Zusagen kann man bei privaten Partys erst mit Zugang,
/// dann zeigt die Seite schon die volle Adresse.
enum PartyCalendar {
    enum Failure: Error {
        case noAccess
    }

    /// Ohne Ende rechnet der Eintrag mit drei Stunden, damit er im Kalender sichtbar ist.
    private static let assumedLength: TimeInterval = 3 * 60 * 60
    private static let offeredKey = "calendarOfferedParties"

    /// Die Frage kommt pro Party nur einmal, auch nach Absagen und erneutem Zusagen.
    static func wasOffered(_ party: UUID) -> Bool {
        let ids = UserDefaults.standard.stringArray(forKey: offeredKey) ?? []
        return ids.contains(party.uuidString)
    }

    static func markOffered(_ party: UUID) {
        var ids = UserDefaults.standard.stringArray(forKey: offeredKey) ?? []
        guard !ids.contains(party.uuidString) else { return }
        ids.append(party.uuidString)
        // Nur die letzten 200, damit die Liste nicht endlos wächst.
        UserDefaults.standard.set(Array(ids.suffix(200)), forKey: offeredKey)
    }

    static func add(_ party: PartyDetail) async throws {
        let store = EKEventStore()
        guard try await store.requestWriteOnlyAccessToEvents() else { throw Failure.noAccess }

        let event = EKEvent(eventStore: store)
        event.calendar = store.defaultCalendarForNewEvents
        event.title = party.title
        event.startDate = party.eventDate
        if party.isAllDay == true {
            event.isAllDay = true
            event.endDate = party.endsAt ?? party.eventDate
        } else {
            event.endDate = party.endsAt ?? party.eventDate.addingTimeInterval(assumedLength)
        }

        if let location = party.location, !location.isEmpty {
            event.location = location
            if party.isExact, let lat = party.lat, let lng = party.lng {
                let place = EKStructuredLocation(title: location)
                place.geoLocation = CLLocation(latitude: lat, longitude: lng)
                event.structuredLocation = place
            }
        }

        try store.save(event, span: .thisEvent)
    }
}
