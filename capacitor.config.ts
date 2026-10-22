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
}

export default config
