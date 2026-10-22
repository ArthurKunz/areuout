import type { CapacitorConfig } from '@capacitor/cli'

// Die App ist eine Huelle um die Live-Seite (Entscheidung 22.10.2026, Variante A):
// Capacitor laedt https://www.areuout.de, nichts davon liegt gebuendelt in der App. Der
// Ordner capacitor-www ist nur der Platzhalter, den Capacitor als webDir verlangt.
//
// Die Adresse MUSS www tragen: areuout.de leitet per 308 auf www.areuout.de um, und
// Capacitor reicht jede Navigation auf einen anderen Host an Safari weiter. Mit der
// blanken Domain oeffnete sich die Seite deshalb ausserhalb der App (Test 22.10.2026).
const config: CapacitorConfig = {
  appId: 'de.areuout.app',
  appName: 'areuout',
  webDir: 'capacitor-www',
  server: {
    url: 'https://www.areuout.de',
    cleartext: false,
    allowNavigation: ['www.areuout.de'],
  },
  plugins: {
    // Nur Sign in with Apple (Schritt 13c). Der Sync-Hook des Plugins kommentiert die
    // Pakete der abgeschalteten Anbieter in seiner Package.swift aus. Beim Facebook-SDK
    // klappt das; das GoogleSignIn-SDK bleibt in Plugin 8.7.5 trotzdem drin (sein Muster
    // verlangt ein Komma, das hinter dem letzten Listeneintrag fehlt). Zur Laufzeit ist
    // Google mit false dennoch aus. Google kommt spaeter mit true dazu.
    SocialLogin: {
      providers: { apple: true, google: false, facebook: false, twitter: false },
    },
  },
}

export default config
