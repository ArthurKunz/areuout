import SwiftUI

/// Farbrollen aus Native Redesign Abschnitt 9. Die Akzentfarbe (Elektroblau #1E5CFF) ist
/// AccentColor im Asset-Katalog und kommt über .tint / .accentColor.
extension Color {
    static let appBackground = Color(hex: 0xF5F5F7)
    static let appSurface = Color(hex: 0xFFFFFF)
    static let appSeparator = Color(hex: 0xDFE1E6)
    static let appPrimaryButton = Color(hex: 0x2C2C2E)
    static let appPlaceholder = Color(hex: 0xC4C4C6)
    static let appDestructive = Color(hex: 0xEA3323)
    static let brandTint = Color(hex: 0x6E93FF)

    // Icon-Farben der Karten und Module.
    static let iconDate = Color(hex: 0xC83E2E)
    static let iconTime = Color(hex: 0x65C466)
    static let iconLocation = Color(hex: 0x6E93FF)
    static let iconCategory = Color(hex: 0x5AC5B3)
    static let iconMotto = Color(hex: 0xC7622E)
    static let iconDresscode = Color(hex: 0xB13A73)
    static let iconPoll = Color(hex: 0x744AC0)
    static let iconQuestion = Color(hex: 0xF7CE46)
    static let iconParticipants = Color(hex: 0x1E5CFF)
    static let iconDescription = Color(hex: 0x9A7B5B)

    /// Aus "#RRGGBB", wie profiles.avatar_color es speichert.
    init(hexString: String) {
        self.init(hex: UInt32(hexString.dropFirst(), radix: 16) ?? 0)
    }

    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}
