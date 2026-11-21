import Foundation

/// Damit eine reine Party-ID ein Sheet öffnen kann (`.sheet(item:)`).
extension UUID: @retroactive Identifiable {
    public var id: UUID { self }
}
