import AuthScreen from '@/features/auth/AuthScreen'

// Die Query wird hier auf dem Server gelesen und als Prop weitergereicht, statt im
// Client über useSearchParams. Vorher lag um AuthScreen eine <Suspense>-Grenze ohne
// fallback — und Suspense ohne fallback rendert null. Der Server lieferte deshalb
// einen leeren Body aus (im HTML stand wörtlich BAILOUT_TO_CLIENT_SIDE_RENDERING),
// und wer die Seite aufrief, sah nichts, bis das JavaScript geladen und ausgeführt war.
//
// Das macht diese Route dynamisch. Für einen Anmeldebildschirm ist daran nichts
// verloren: es gibt hier nichts zu cachen.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; next?: string }>
}) {
  const { step, next } = await searchParams
  return <AuthScreen stepParam={step ?? null} nextParam={next ?? null} />
}
