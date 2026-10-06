import OnboardingScreen from '@/features/onboarding/OnboardingScreen'

// Aus demselben Grund wie beim Login: die Query serverseitig lesen, damit der Screen
// auch wirklich auf dem Server gerendert wird.
export default async function Onboarding({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  return <OnboardingScreen nextParam={next ?? null} />
}
