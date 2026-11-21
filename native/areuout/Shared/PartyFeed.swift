import Observation

/// Zählt Änderungen an Partys (erstellt, bearbeitet, gelöscht, beantwortet), damit Karte
/// und Listen neu laden, ohne dass jede Ansicht die anderen kennen muss.
@Observable
final class PartyFeed {
    private(set) var version = 0

    func changed() { version += 1 }
}
