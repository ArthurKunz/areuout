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
    // Sign in with Apple und Google nativ (Schritt 13c): Google sperrt seine OAuth-Seite
    // im WebView der App. Der Sync-Hook des Plugins kommentiert die Pakete der
    // abgeschalteten Anbieter in seiner Package.swift aus. Beim Facebook-SDK klappt das;
    // das GoogleSignIn-SDK bliebe in Plugin 8.7.5 auch mit false drin (sein Muster
    // verlangt ein Komma, das hinter dem letzten Listeneintrag fehlt), und mit dem SDK
    // waere Google auch zur Laufzeit an: das Plugin prueft fuer Google nur, ob das SDK
    // da ist, nicht diesen Schalter. Seit Google gewollt ist, schadet der Fehler nicht.
    // Google braucht ausserdem das URL-Schema in Info.plist, sonst stuerzt die App ab.
    SocialLogin: {
      providers: { apple: true, google: true, facebook: false, twitter: false },
    },
  },
}

export default config
