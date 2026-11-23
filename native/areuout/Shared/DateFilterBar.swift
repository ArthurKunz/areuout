import SwiftUI

/// Datums-Reihe über Explore und Parties (Arthur, 2026-11-23): links ein Kalender-Knopf, dann
/// `Heute`, `Morgen` und die weiteren Wochentage bis Sonntag. Samstags und sonntags läuft die
/// Reihe bis zum nächsten Sonntag, damit sie nie fast leer ist. Im Kalender gibt es nur heute
/// und später, denn vergangene Partys liefert der Server nicht aus.
/// Ein Tipp wählt einen Tag, ein zweiter Tipp auf denselben Tag hebt die Auswahl auf.
struct DateFilterBar: View {
    @Binding var day: Date?
    @State private var showCalendar = false

    private var calendar: Calendar { .current }

    var body: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                calendarButton
                if let day, !days.contains(day) {
                    chip(Self.shortDate(day), day: day)
                }
                ForEach(days, id: \.self) { date in
                    chip(label(for: date), day: date)
                }
            }
            .padding(.vertical, 4)
        }
        .scrollIndicators(.hidden)
        .contentMargins(.horizontal, 20, for: .scrollContent)
        .dynamicTypeSize(...DynamicTypeSize.xxLarge)
    }

    // MARK: Tage

    /// Heute bis Sonntag; ab Samstag bis zum Sonntag der nächsten Woche.
    private var days: [Date] {
        let today = calendar.startOfDay(for: .now)
        // Wochentag mit Montag = 0 … Sonntag = 6.
        let weekday = (calendar.component(.weekday, from: today) + 5) % 7
        let untilSunday = 6 - weekday
        let count = untilSunday < 2 ? untilSunday + 7 : untilSunday
        return (0...count).compactMap { calendar.date(byAdding: .day, value: $0, to: today) }
    }

    private func label(for date: Date) -> String {
        if calendar.isDateInToday(date) { return "Heute" }
        if calendar.isDateInTomorrow(date) { return "Morgen" }
        return date.formatted(.dateTime.weekday(.abbreviated).locale(Locale(identifier: "de_DE")))
            .replacingOccurrences(of: ".", with: "")
    }

    private static func shortDate(_ date: Date) -> String {
        date.formatted(.dateTime.day().month(.abbreviated).locale(Locale(identifier: "de_DE")))
    }

    // MARK: Knöpfe

    private var calendarButton: some View {
        Button {
            showCalendar = true
        } label: {
            Image(systemName: "calendar")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Color(.label))
                .frame(width: 38, height: 38)
                .glassEffect(.regular.interactive(), in: Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Datum wählen")
        .popover(isPresented: $showCalendar) {
            DatePicker(
                "Datum",
                selection: Binding(
                    get: { day ?? calendar.startOfDay(for: .now) },
                    set: { newValue in
                        day = calendar.startOfDay(for: newValue)
                        showCalendar = false
                    }
                ),
                in: calendar.startOfDay(for: .now)...,
                displayedComponents: .date
            )
            .datePickerStyle(.graphical)
            .labelsHidden()
            .environment(\.locale, Locale(identifier: "de_DE"))
            .frame(width: 320)
            .padding(8)
            .presentationCompactAdaptation(.popover)
        }
    }

    private func chip(_ title: String, day date: Date) -> some View {
        let isSelected = day.map { calendar.isDate($0, inSameDayAs: date) } ?? false
        return Button {
            day = isSelected ? nil : date
        } label: {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(isSelected ? Color(.systemBackground) : Color(.label))
                .padding(.horizontal, 14)
                .frame(height: 38)
                .glassEffect(isSelected ? .regular.tint(Color(.label)).interactive() : .regular.interactive(), in: Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

extension Array where Element == PartySummary {
    /// Partys, die an diesem Tag stattfinden (auch wenn sie am Vortag beginnen und hineinreichen).
    func on(_ day: Date?) -> [PartySummary] {
        guard let day else { return self }
        let calendar = Calendar.current
        let start = calendar.startOfDay(for: day)
        guard let end = calendar.date(byAdding: .day, value: 1, to: start) else { return self }
        return filter { party in
            party.eventDate < end && (party.endsAt ?? party.eventDate) >= start
        }
    }
}
