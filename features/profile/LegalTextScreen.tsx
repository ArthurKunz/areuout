'use client'

import { useRouter } from 'next/navigation'
import StepFrame from '@/features/create-party/StepFrame'

// A legal document is a numbered list of sections, not a wall of paragraphs, so the
// three pages hand over their headings and the screen renders the structure.
export type LegalSection = {
  // Left out for the lead-in above the first numbered heading.
  heading?: string
  paragraphs: string[]
}

// Longer than 'Datenschutz' (11) and 'Impressum' (9), shorter than
// 'Nutzungsbedingungen' (19): the titles that no longer fit at text-heading-3.
const LONG_TITLE = 14

// All three legal pages are the same page with different words.
//
// No session check: these are the only screens in the app that have to render for
// someone WITHOUT an account. An Impressum has to be reachable without signing in,
// and nobody can be asked to agree to terms they must first create an account to
// read — so they live at the app root rather than under /me, and proxy.ts lets
// them through unauthenticated.
//
// They stay full-screen pages outside app/(shell) on purpose: no map, so reading the
// Datenschutz or the Impressum sends no request to OpenFreeMap. The look is the
// redesign's all the same: StepFrame's header, and one column at the container's
// width with every section a card like the detail's InfoCard (not glass).
export default function LegalTextScreen({
  title,
  sections,
  updated,
}: {
  title: string
  sections: LegalSection[]
  // The date the wording last changed. A legal text without one is hard to argue with.
  updated: string
}) {
  const router = useRouter()

  // The page is reached from four directions — the profile's 'Rechtliches' list, the
  // sign-up sheet, the footer of the auth and invite screens, and a typed URL — and
  // only the visitor's own history knows which. Going back one step lands correctly in
  // all of them; a fixed href would send a signed-out reader into the login.
  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }
    router.push('/')
  }

  return (
    // pt-6 makes up for StepFrame's -mt-6, which inside the container runs the body up
    // under the rounded corners.
    <div className='mx-auto flex min-h-dvh w-shell-width flex-col pt-6 pb-safe-rsvp'>
      {/* The title as StepFrame would set it, except that a long one steps down to
          text-text-1 instead of being truncated: 'Nutzungsbedingungen' needs 235px at
          22px, the column leaves 213 to 231 between the two button slots, and a legal
          page has to say in full what it is. The page files stay as they are, so the
          length decides here. */}
      <StepFrame
        title={
          <h1 className={`min-w-0 text-center font-bold text-heading ${title.length > LONG_TITLE ? 'text-text-1' : 'text-heading-3'}`}>
            {title}
          </h1>
        }
        onBack={goBack}
        button={null}
      >
        <span className='w-full text-center text-text-4 text-text'>Stand: {updated}</span>

        {sections.map((section, i) => (
          // bg-secondary, not the InfoCard's bg-main: that is 40% black and only reads over
          // the container's glass. On this black page it would vanish.
          <section key={i} className='flex w-full flex-col gap-2 rounded-[25px] bg-secondary p-4'>
            {section.heading && <h2 className='text-text-1 font-semibold text-heading'>{section.heading}</h2>}
            {section.paragraphs.map((paragraph, j) => (
              <p key={j} className='text-text-3 text-main-white'>
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </StepFrame>
    </div>
  )
}
