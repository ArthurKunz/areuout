import type { NextConfig } from 'next'

// Fuenf Kopfzeilen auf jeder Antwort. Vercel setzt von sich aus keine davon, und Next
// auch nicht — ohne sie liefert die App genau die Vorgaben aus, die ein Browser
// annimmt, wenn ihm niemand etwas sagt.
//
// Was hier BEWUSST fehlt, ist eine Content-Security-Policy. Sie muesste Google Maps
// (Static-Bilder), Photon (fetch), Supabase (REST, Storage, Realtime) und die eigenen
// Inline-Styles einzeln erlauben; eine zu enge Regel bricht die Karte oder die
// Adresssuche, ohne dass es beim Bauen auffaellt. Das gehoert in eine eigene Runde mit
// Report-Only-Modus davor, nicht in eine Zeile nebenbei.
const SECURITY_HEADERS = [
  // Clickjacking. Die App hat Schaltflaechen, die ein Konto samt aller Partys
  // unwiderruflich loeschen — die haben in einem fremden iframe nichts zu suchen.
  { key: 'X-Frame-Options', value: 'DENY' },
  // Der moderne Zwilling davon, den Firefox und Chrome bevorzugt lesen.
  { key: 'Content-Security-Policy', value: 'frame-ancestors \'none\'' },
  // Ein Einladungslink traegt den Code, der die Party schuetzt. Ohne diese Zeile
  // schickt der Browser die volle Adresse als Referer mit, sobald jemand auf der
  // Party-Seite die Karte antippt — der Code stuende dann in Googles Protokoll.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Kein MIME-Sniffing: ein hochgeladenes Bild bleibt ein Bild, auch wenn jemand
  // etwas anderes hineingeschrieben hat.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Die App fragt nie nach Standort, Kamera oder Mikrofon. Dann soll auch nichts, was
  // in ihr laeuft, danach fragen koennen.
  { key: 'Permissions-Policy', value: 'geolocation=(), camera=(), microphone=(), payment=(), usb=()' },
]

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.188.167', '192.168.0.*', '192.168.1.*', '10.0.0.*', 'survive-congenial-survival.ngrok-free.dev'],
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }]
  },
}

export default nextConfig
