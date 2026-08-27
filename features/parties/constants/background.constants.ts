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
