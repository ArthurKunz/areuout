# Design: locked at the end of step 11b

Arthur tested this on his phone and on a wide screen and keeps it as the reference look.
**Do not change a value on this page, and do not add a new surface style, without asking
Arthur.** The tokens live in `app/globals.css`; this page says what they mean and who
uses them.

## Width and position

- `--spacing-shell-width` = `min(385px, 100vw - 2 x --spacing-sheet-gutter)`. The
  container frame and its handle (`components/shell/Sheet.tsx`) and the navbar
  (`components/shell/TabNav.tsx`) use it as `w-shell-width`. 385 is written nowhere else.
- Phone (below `md`, 768px): the block is centred. A 393 phone gets 373px, a 375 phone
  355px, a 430 phone 385px.
- Wide screen (`md` and up): container and navbar sit together in the bottom left
  corner, `left: --spacing-sheet-gutter`, same bottom spacing as on a phone. The map
  stays full screen behind them.
- `MapContext.containerInset()` writes the same breakpoint as `48rem` for the map's
  padding. Change one, change the other.

| Token | Value |
|---|---|
| `--spacing-sheet-gutter` | 10px |
| `--spacing-nav-bottom` | 20px |
| `--spacing-sheet-bottom` | nav-bottom minus 14px = 6px. Never below 6px: iOS 26 tints Safari's toolbar |
| `--spacing-nav-height` | 75px |
| `--spacing-sheet-height` / `-max` | 50svh / 80svh (the fitted container) |
| `--radius-sheet` | 35px |

## Glass tiers

Every glass surface is one of four classes in `globals.css`. Each is blur (plus
`saturate(160%)`), a 1px gradient rim (`::before`), an inset top highlight, an inset
glow and an outer shadow.

| Class | Blur | Rim start / end | Highlight | Glow | Shadow | Used by |
|---|---|---|---|---|---|---|
| `glass-surface` | 10px (navbar 15px) | .37 / .20 | .23 | .04 | 0 8px 32px .17 | containers (Sheet), navbar (TabNav) |
| `glass-field` | 24px | .27 / .13 | .17 | .03 | 0 4px 16px .12 | Input, InputGroup, SearchInput, ToggleInput, SettingsList, LocationResultsList, the create flow's cards (`cardClass`, DescriptionStep, Preview), PollOptionResults, PollQuestionBanner, AnswerBubble |
| `glass-control` | 24px | .40 / .20 | .25 | .05 | 0 4px 16px .18 | buttons only: IconButton (✗ ⋯ share back), AddButton, BigButton, ImageUploadCircle, the profile pencil, RsvpStatusButton, the detail's round ✗ and ?, the picker's ✗ and ✓ |
| `glass-overlay` | 40px | .37 / .20 | .23 | .04 | 0 16px 48px .23 | RsvpStatusMenu, the ⋯ menu (HostActions), ConfirmPrompt, the picker panel (WheelSheet) |

Highlight, glow and rim are white at the given opacity, shadow is black. The navbar's
shadow is `--glass-nav-shadow` (same as surface): if the green strip behind Safari's
toolbar returns, set it to `0 0 #0000`. The buttons, above all the small round ones,
are never made subtler. The detail's info cards and the guest list are intentionally
not glass.

## Header rule

Every header inside the container is the first child of the scrolling body, at the top
of the content: `DetailHeader`, `PageHeader`, and `StepFrame` (create, edit, auth,
onboarding, profile sub-pages). It scrolls away with the content, nothing is fixed,
there is no bar or blur behind the buttons, and nothing appears on scroll up. Two
things stay fixed on purpose: the `ListHeader` of Explore, My Parties and Hosting (it
is the container's grab area) and a step's one action button at the bottom.

## Icon colours

The round icon of a card or tile (`InfoCard` in `features/party-detail/DetailCards.tsx`)
takes one of the `--color-*` tokens from `globals.css`. Tailwind builds the `bg-` and
`text-` variants from the token, so no colour is written twice.

| Token | Hex | Used by |
|---|---|---|
| `--color-lime` | #A4D400 | the open requests only: the `Anfragen` card in the detail and the `Anfragen` tile on its page. Added in step 11c with Arthur's approval. |

The symbol stays `text-main-white`, as on every other icon circle. Any further colour
needs Arthur's approval.
