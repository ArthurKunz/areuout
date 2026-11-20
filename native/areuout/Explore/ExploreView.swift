import MapKit
import Supabase
import SwiftUI

/// Explore (Native Redesign 5.2): Apple-Karte von Leipzig, jede sichtbare Party als Kreis
/// mit ihrem Bild. Ein Tipp öffnet die Party. Kein eigener Standort, keine Standort-Abfrage
/// (entschieden 2026-10-22), kein Radar (2026-11-20).
struct ExploreView: View {
    /// Leipzig mit Umland, wie LEIPZIG_BOUNDS der Web-App (Brehna bis Lucka).
    private static let leipzig = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 51.33, longitude: 12.38),
        span: MKCoordinateSpan(latitudeDelta: 0.46, longitudeDelta: 0.36)
    )

    @State private var position: MapCameraPosition = .region(leipzig)
    @State private var parties: [PartySummary] = []
    @State private var selected: PartySummary?
    @State private var loadFailed = false

    var body: some View {
        Map(position: $position) {
            ForEach(parties) { party in
                Annotation(party.title, coordinate: party.coordinate, anchor: .center) {
                    Button {
                        selected = party
                    } label: {
                        PartyCircle(url: party.imageURL)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(party.title)
                }
                .annotationTitles(.hidden)
            }
        }
        .mapStyle(.standard(pointsOfInterest: .excludingAll))
        .mapControls {
            MapCompass()
        }
        .ignoresSafeArea()
        .overlay(alignment: .top) {
            if loadFailed {
                Button("Partys konnten nicht geladen werden. Nochmal versuchen") {
                    Task { await load() }
                }
                .font(.footnote)
                .buttonStyle(.glass)
                .padding(.top, 8)
            }
        }
        .sheet(item: $selected) { party in
            PartyDetailPlaceholder(party: party)
        }
        .task { await load() }
    }

    private func load() async {
        do {
            parties = try await supabase.rpc("get_explore_parties").execute().value
            loadFailed = false
        } catch {
            loadFailed = true
        }
    }
}

/// Der runde Party-Kreis auf der Karte: Bild mit dünnem dunklem Rand, alle gleich groß.
private struct PartyCircle: View {
    let url: URL?

    var body: some View {
        AsyncImage(url: url) { image in
            image.resizable().scaledToFill()
        } placeholder: {
            Color.appPlaceholder
        }
        .frame(width: 46, height: 46)
        .clipShape(Circle())
        .overlay(Circle().stroke(Color.black.opacity(0.8), lineWidth: 2))
        .shadow(color: .black.opacity(0.25), radius: 3, y: 1)
        .contentShape(Circle())
    }
}

/// Platzhalter bis Schritt 5 (Party-Detail).
private struct PartyDetailPlaceholder: View {
    @Environment(\.dismiss) private var dismiss
    let party: PartySummary

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                AsyncImage(url: party.imageURL) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Color.appPlaceholder
                }
                .frame(height: 260)
                .clipped()

                Text(party.title).font(.title.bold())
                Text(party.eventDate.formatted(date: .complete, time: .shortened))
                    .foregroundStyle(.secondary)
                Text("Die Detail-Seite kommt in Schritt 5.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                Spacer()
            }
            .ignoresSafeArea(edges: .top)
            .background(Color.appBackground)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .close) { dismiss() }
                }
            }
        }
    }
}
