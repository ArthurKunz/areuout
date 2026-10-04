import HostingScreen from '@/features/hosting/HostingScreen'

// `party` reopens a party's detail, e.g. coming back from Edit Party. The detail itself
// is not a route (App Redesign 3.5); the query only restores it. `searchParams` is a
// Promise in this Next version (node_modules/next/dist/docs/01-app/03-api-reference/
// 03-file-conventions/page.md).
export default async function HostingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { party } = await searchParams
  return <HostingScreen initialParty={typeof party === 'string' ? party : null} />
}
