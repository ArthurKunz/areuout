// A legal document is a numbered list of sections, not a wall of paragraphs, so the
// three pages hand over their headings and the screen renders the structure.
export type LegalSection = {
  // Left out for the lead-in above the first numbered heading.
  heading?: string
  paragraphs: string[]
}

// One legal text as the website shows it and app/legal/[doc]/route.ts hands it to the
// iOS app. `updated` is the date the wording last changed.
export type LegalDocument = {
  title: string
  updated: string
  sections: LegalSection[]
}
