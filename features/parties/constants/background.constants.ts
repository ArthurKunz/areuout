// Die Regeln für Party-Hintergründe, gemeinsam für den Erstellen- und den
// Bearbeiten-Screen. Vorher standen sie nur in CreatePartyScreen — und ein zweiter
// Screen, der sie noch einmal hinschreibt, ist ein zweiter Screen, der sie beim
// nächsten Mal anders hinschreibt.

// 'event-backgrounds', nicht 'party-backgrounds': die Umbenennung von event zu party
// ging durch den ganzen Code, der BUCKET aber heisst unverändert so. Jeder Upload
// gegen den falschen Namen scheitert stumm gegen einen Bucket, den es nicht gibt.
export const BG_BUCKET = 'event-backgrounds'

// Grosszügiger als beim Avatar (5 MB): ein Hintergrund ist ein Querformat, das über
// die ganze Breite läuft. Der Bucket setzt dieselbe Grenze noch einmal serverseitig.
export const BG_MAX_BYTES = 10 * 1024 * 1024

// Die acht Motive aus /public/backgrounds. Wird eines gewählt, landet sein Pfad direkt
// in events.background_url — hochgeladen wird dabei nichts.
export const BG_PRESETS = Array.from({ length: 8 }, (_, i) => `/backgrounds/bg-${i + 1}.jpg`)

// The redesigned create flow shows six of the eight (App Redesign 7.5): bg-5 and bg-6
// are dropped, the first a near-black silhouette that reads as an empty dark circle at
// that size, the second a magenta laser club too close to bg-2. BG_PRESETS stays at
// eight for the old create and edit screens.
export const COVER_PRESETS = [1, 2, 3, 4, 7, 8].map((n) => BG_PRESETS[n - 1])
