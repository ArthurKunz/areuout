import SwiftUI

/// Eine Karte im Party-Detail: farbiges Icon, Titel, Wert in Grau, optional ein Link unten.
struct DetailCardItem {
    let icon: String
    let color: Color
    let title: String
    let value: String?
    var isHalf = false
    var link: (title: String, action: () -> Void)?
}

struct DetailCard: View {
    let item: DetailCardItem

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Image(systemName: item.icon)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 28, height: 28)
                .background(item.color, in: Circle())
                .padding(.bottom, 2)
            Text(item.title)
                .font(.headline)
            if let value = item.value {
                Text(value)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let link = item.link {
                Divider().padding(.vertical, 4)
                Button(action: link.action) {
                    HStack {
                        Text(link.title)
                        Spacer()
                        Image(systemName: "chevron.right")
                    }
                    .font(.subheadline.weight(.semibold))
                }
                .tint(Color.accentColor)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appSurface, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    }
}

/// Deutsche Anzeige von Datum, Uhrzeit, Preis und Kategorie (Native Redesign 11a).
enum PartyFormat {
    private static let berlin = TimeZone(identifier: "Europe/Berlin")!

    private static func formatter(_ format: String) -> DateFormatter {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "de_DE")
        formatter.timeZone = berlin
        formatter.dateFormat = format
        return formatter
    }

    private static let shortDate = formatter("dd.MM.yy")
    private static let clock = formatter("HH:mm")
    private static let longDate = formatter("EE, d. MMMM")

    /// `26.11.26`
    static func date(_ date: Date) -> String { shortDate.string(from: date) }

    /// `23:00 - 02:00 Uhr`, nur Start, oder `Ganztägig`.
    static func time(_ detail: PartyDetail) -> String {
        if detail.isAllDay == true { return "Ganztägig" }
        let start = clock.string(from: detail.eventDate)
        guard let end = detail.endsAt else { return "\(start) Uhr" }
        return "\(start) - \(clock.string(from: end)) Uhr"
    }

    /// `Mo., 23. November um 18:00 Uhr` (Karten im Parties-Tab).
    static func cardDate(_ date: Date, allDay: Bool) -> String {
        let day = longDate.string(from: date)
        return allDay ? day : "\(day) um \(clock.string(from: date)) Uhr"
    }

    /// Kalendertage bis zur Party (Berliner Zeit), 0 heißt heute.
    static func daysUntil(_ date: Date) -> Int {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = berlin
        let from = calendar.startOfDay(for: Date())
        let to = calendar.startOfDay(for: date)
        return max(0, calendar.dateComponents([.day], from: from, to: to).day ?? 0)
    }

    /// `5,50 €`, `0` ist `Kostenlos`.
    static func price(_ value: Double) -> String {
        if value == 0 { return "Kostenlos" }
        return value.formatted(.currency(code: "EUR").locale(Locale(identifier: "de_DE")))
    }

    static func category(_ value: String?, other: String?) -> String? {
        switch value {
        case "house": "Hausparty"
        case "club": "Club"
        case "open_air": "Open-air"
        case "festival": "Festival"
        case "other": other ?? "Etwas anderes"
        default: nil
        }
    }
}
