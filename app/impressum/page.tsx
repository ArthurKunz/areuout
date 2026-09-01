import LegalTextScreen, { type LegalSection } from '@/features/profile/LegalTextScreen'

// Bewusst nur die Pflichtangaben nach § 5 DDG — Arthur hat am 23.08.2026 entschieden,
// alles Freiwillige zu streichen. Für eine natürliche Person ohne Registereintrag sind
// das genau zwei Punkte:
//
//   § 5 Abs. 1 Nr. 1  Name und ladungsfähige Anschrift (kein Postfach)
//   § 5 Abs. 1 Nr. 2  E-Mail plus ein zweiter, schnell erreichbarer Weg — hier Telefon
//
// Alles Weitere aus § 5 (Rechtsform, Vertretungsberechtigte, Register, USt-IdNr.,
// Aufsichtsbehörde, Berufsbezeichnung) hat kein Gegenstück: kein Gewerbe, keine
// Gewinnerzielungsabsicht, kein Registereintrag. Die Herleitung dazu liegt im Second
// Brain unter '04 Resources/Claude Code/areuout Repo Backup 2026-09-01/
// RECHTLICHES-BESTANDSAUFNAHME.md', Abschnitt 0 — sie ist am 01.09.2026 aus dem
// Repository dorthin gezogen. Sobald Geld fließt, ist diese Seite die erste, die sich
// ändert.
//
// Entfernt am 23.08.2026, weil nicht vorgeschrieben: § 18 Abs. 2 MStV (gilt nur für
// journalistisch-redaktionelle Angebote), Art des Angebots, Haftung für Links und
// Haftung für Nutzerinhalte. Die Streitbeilegung musste ohnehin weichen — die
// EU-ODR-Plattform ist seit dem 20.07.2025 abgeschaltet. Die Haftung für fremde
// Inhalte steht weiterhin in den Nutzungsbedingungen, §§ 5 bis 7 und 9.
const SECTIONS: LegalSection[] = [
  {
    paragraphs: [
      'Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG).',
    ],
  },
  {
    heading: 'Anbieter',
    paragraphs: [
      'Arthur Kunz',
      'Bretschneiderstraße 14',
      '04229 Leipzig',
      'Deutschland',
    ],
  },
  {
    heading: 'Kontakt',
    paragraphs: [
      'Telefon: +49 173 3530620',
      'E-Mail: azzuro.kunz@gmail.com',
    ],
  },
]

export default function ImpressumPage() {
  return <LegalTextScreen title='Impressum' sections={SECTIONS} updated='23. August 2026' />
}
