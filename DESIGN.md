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

## Motion

Added in step 11d. Same lock as the rest of this page: no new duration, curve or
animation without asking Arthur. The tokens live in the `MOTION` block of `globals.css`;
no component writes a number of its own.

| Token | Value | For |
|---|---|---|
| `--ease-ios` | `cubic-bezier(0.32, 0.72, 0, 1)` | everything that moves on screen or leaves it |
| `--ease-out-soft` | `cubic-bezier(0.23, 1, 0.32, 1)` | only things that appear |
| `--duration-press` | 150ms | press and release, a selected tick, colour on a toggle of state |
| `--duration-exit` | 160ms | a menu or prompt leaving |
| `--duration-enter` | 220ms | a menu or prompt appearing, loaded content fading in, the switch |
| `--duration-move` | 300ms | something changing place: the page push, the TabNav selector, the swipe settle, the poll bar, `Collapse`, `WheelSheet` |

In Tailwind: `ease-ios`, and `duration-(--duration-press)` (there is no duration
namespace). `CLOSE_MS` in `WheelSheet.tsx` is `--duration-move` written twice.

**Rules**

- Only `transform`, `translate`, `scale` and `opacity` animate. Tailwind v4 writes
  `scale-*` and `translate-*` as their own properties, so a transition list names
  `scale` or `translate`, not just `transform`.
- The finger gets physics, everything else a curve. `Sheet.tsx` is the one spring
  (critically damped, response 0.35, Apple's momentum projection, rubber band); it is
  not to be rebuilt. `SwipeToRemove` uses the same projection to decide open or closed.
- Enter and exit along the same path: a page leaves to the right it came from, a menu
  shrinks back into its trigger (`transform-origin` at the trigger; a modal grows from
  its centre).
- Exits without JavaScript: popups stay rendered and switch with `data-open`, closed is
  `display: none`, and `display` is part of the transition (`allow-discrete`), so the
  exit plays first. iOS 17.4 and newer; older ones show and hide without motion.
- Reduced motion always: `--duration-move` collapses to nothing, travel is dropped, the
  fades stay.
- **Never fade or move an element that has glass inside it.** Opacity on an ancestor
  makes it the glass's backdrop root and leaves the glass flat until the animation
  ends. Glass that has to appear is revealed by height through `Collapse` — the one
  exception to the first rule, used by `WarningBanner`, new poll options and the
  existing `Collapse`/`WheelSheet` cases.

**The classes** (`globals.css`, `@layer utilities`)

| Class | Does | Used by |
|---|---|---|
| press | `active:scale-95` (small round buttons `active:scale-90`) over `--duration-press` | every button |
| row press | `active:bg-selector` in a card, `active:opacity-60` for a loose row or a name | `SettingsList`, `LocationResultsList`, `PickerRow` / party list, guests, requests, voters, answers, host name, card links |
| `.page-layer` | the iOS push: in from the right, the one underneath a quarter left and faded out | the detail and its pages (`PartyDetail`) |
| `.pop` / `.pop-fade` | grow from 0.95 with a fade / only fade, on `data-open` | the ⋯ menu, the RSVP menu, `ConfirmPrompt` and its backdrop |
| `.pop-rise` | fade and an 8px drop by `translate` (`Sheet` owns the bar's `transform`) | `TabNav` |
| `.icon-in` | a glyph grows in from 0.6 when it is inserted | the share tick, the RSVP and poll ticks |
| `animate-fade-in-up` | fade and an 8px rise on mount | the detail's cards, the three party lists and their empty text |

**Left without motion on purpose**

- The map camera (maplibre's own) and the map markers: the circle becomes a pin by
  being destroyed and recreated, a morph needs the marker rebuilt.
- Switching tabs: tapped many times a day, and the container, handle and bar persist.
- Steps in create, edit, auth and onboarding, and the loaded Teilnehmer, Anfragen,
  profile and Edit Party: full of glass (see the last rule).
- Removing a row, the invite bar disappearing after the first answer, the detail's
  card grid reflowing, the fitted container changing height: each needs a height
  animation on exit.
- `Chip`, `ImageUploadCircle`: they swap whole elements, not classes.
- Avatars and list pictures loading.
- `SwipeToRemove`'s red button still grows by `width` (shipped; the rows are
  see-through, so a full-width button would shine through them).

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
| `--color-slate` | #7A8594 | the price only: the `Preis` chip in the Features step of Create and Edit Party, and the `Preis` card's icon in the detail. Added in step 11c with Arthur's approval. |

The symbol stays `text-main-white`, as on every other icon circle. Any further colour
needs Arthur's approval.

## Card widths in the detail

The detail's cards sit in a two-column grid (`features/party-detail/DetailCards.tsx`).
A card is either half width or full width:

- Half width: `Datum`, `Uhrzeit`, `Dresscode`, `Motto`, `Preis`.
- Full width: `Location`, `Teilnehmer`, `Anfragen`, `Infos`, every poll, every question.

**Consecutive half-width cards fill a row in pairs; a half-width card left without a
partner in its row takes the full width instead of leaving a gap.** A full-width card
always starts a new row, so a run of half cards is the same thing as a row, and the odd
last one of a run goes wide. So `Motto` on its own is full width, `Dresscode` plus
`Motto` share a row, and `Dresscode` plus `Motto` plus `Preis` puts `Preis` full width
underneath the pair.

The rule lives once in `widths()` beside the grid, never on a card: no card decides its
own width. Added in step 11c with Arthur's approval; before it, a lone half card kept
half width and left a gap.
