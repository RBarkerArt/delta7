# Modal Interactivity Plan — The Must-Click Overhaul

*Synthesized 2026-07-03 from four parallel design explorations (micro-games,
puzzles/ARG, modal interaction craft, hook psychology). Goal: make every modal
feel like part of the story, a must-click narrative act, and a reason to come
back tomorrow.*

## Design north star

The fiction's core mechanic — **the room holds together because someone is
looking** — is the design law for everything below. The play is always the
visitor lending attention; the reward is always story (the room or Kael letting
something through). Failure is never a fail state: a wrong answer is just the
instrument staying confidently wrong, which is canon.

House rules (keep it an art project, not a casino):
- **No empty opens.** Every modal always carries at least marginalia; variable
  reward means variance, never deprivation.
- **No punishment, only melancholy.** Gaps produce sadder Kael, never lockouts
  or reset-to-zero.
- **Pity timers** on every near-miss loop — "almost" always resolves to a real
  catch eventually.
- **Bonuses, not gates.** Core story is never hour-gated or puzzle-gated.
- **Real numbers only** for any social proof. Persistence rides the existing
  `recoveredItems` / observer-doc pattern — no new tracking surface.

---

## The Top 10

### 1. Origin Flight + Physical Close — the modal comes off the wall
The modal springs geometrically from the exact hotspot you touched (drawer
slides out of the drawer, blackboard zooms up from the board) and closes back
into it — plus variant-matched close gestures (swipe the drawer shut, toss the
photo down). Kills the "generic dialog" feel in one move; every other idea
lands better once the panel physically belongs to the room.
- **Build:** capture hotspot `getBoundingClientRect()`, thread as `originRect`
  to `RoomModal`, drive enter/exit transform via CSS custom props
  (`--origin-x/y/scale`). Reduced-motion falls back to current fade.
- **Effort: M** · Foundation — ship first.

### 2. The Room Remembers — modal-to-room continuity + dog-ears
Opening a modal changes the room render underneath (drawer ajar, fridge glow,
wiped fog patch persists); artifacts you've read carry permanent traces (a
dog-eared corner, a coffee ring, a fingerprint on the glass). The cheapest,
deepest "I was here and I changed something."
- **Build:** 1–2 persistent channels on the `roomFx` bus read as shader
  uniforms + a `read:{variant}` set in the observer session rendering a
  corner-fold pseudo-element. Dog-ears alone are **S**; room-render traces **M**.
- **Effort: S+M** · Ship dog-ears in week one.

### 3. The Signature Log — sign the ledger before you leave
One clipboard panel asks you to sign the daily observation log. Yesterday's
signature sits above today's blank line; missed days stay visibly blank, and
Kael's marginalia reacts to the gap ("Two days blank. I filled them with my own
hand. It's not the same."). A streak mechanic with zero streak-shaming — the
ledger never resets.
- **Build:** recovery id `sign:day:${day}` in `recoveredItems`; render last N
  signed days; gap-aware marginalia branch keyed on `daysSinceLastSign`;
  `triggerRecoverySurge()` on sign.
- **Effort: S** · Highest hook-per-effort in the entire set.

### 4. Kael Knows You Were Gone — absence addressed to you
After a real absence, the first modal you open on return leads with a line
written to your specific gap ("Eleven hours. The needle drifted the whole time.
I kept the feed open."). Relief, never reproach. The strongest parasocial
retention lever available, and the plumbing already exists.
- **Build:** `absenceWatcher.onReturn(driftMs)` + `lastSeenAt` →
  one-shot `returnGreetingPending` flag consumed by the next opened modal via a
  new `getReturnMarginalia(hours, seed)`.
- **Effort: S–M**

### 5. Signal Lock — the relay you must tune (flagship micro-game)
In `cart-relay-tuning` (stub already exists): two touch dials phase-match a
drifting carrier wave; the noise floor drops as you converge, `playStabilize()`
on lock, and a day-gated Kael transmission decodes via `DecodeText` — text you
can't read anywhere else. Winning fires `grantCoherenceBonus(8, 20)` +
`pulseRoomFx()` so the room visibly heals behind the modal. Giving up resolves
to garbled-but-evocative text ("…the phase won't hold without you here…").
- **Build:** two SVG slider handles, one rAF loop mixing sines, target seeded
  from `hashSeed(visitorId + currentDay)`, `markRecovered('relay-frag-{day}')`.
  Keyboard/SR fallback: native range inputs, auto-resolve on focus.
- **Effort: M** · This interaction model (operate the instrument to resolve the
  content) then generalizes to compass, sector-scan, and blackboard.

### 6. Variable Signal — which panel is hot today
Each day, one or two hotspots carry genuinely new content (fresh VM log, new
fragment), rotating per day and partly per observer. A faint diegetic tell — a
slightly brighter monitor glow, a drawer barely ajar — hints where, but you
must open to confirm. The tasteful variable-ratio engine that makes every room
re-openable daily.
- **Build:** featured variant = `seededHash(day + visitorSeed) % panels`;
  bump the hotspot's glow via `roomFx`. Floor guarantee: every panel always has
  marginalia, so no open is a blank.
- **Effort: M**

### 7. The Torn Half + Fragment Sets — collections that ache
Documents open torn: top half legible, bottom ragged ("[remainder filed
elsewhere]"). The matching half surfaces in a different room on a later day;
finding it snaps the halves together on screen. An archive index shows named
sets with empty slots as silhouettes you can read the titles of — and the first
slot arrives pre-filled ("recovered before you arrived") for endowed progress.
Optionally reconstruct damaged entries via drag-to-reorder torn strips
(Continuity Splice micro-game).
- **Build:** `pairId` + `set` fields on fragments in `season1_days.json`;
  torn/joined render states off `recoveredItems`; `ArchiveShelfPanel` /
  `RoomIndexPanel` already render recovered state. Content authoring is the
  real cost.
- **Effort: M**

### 8. Hold It to the Light — tactile hidden layers
A radial reveal mask follows your cursor/finger over an artifact: wipe
condensation off the window, sweep a light across a redacted file, tilt (gyro
opt-in) to catch a watermark. Hidden lines are earned by physically searching,
not scrolled past. Pairs with flip-to-reverse: turn the postcard over to find
Kael's handwriting on the back — the natural new home for marginalia on papery
variants.
- **Build:** CSS `mask-image: radial-gradient(...)` centered on `--light-x/y`
  written from pointer-move rAF (same discipline as the existing tilt);
  `<FlipCard>` wrapper with two faces and a drag-to-flip `--flip` var.
  Reduced-motion/no-pointer: full reveal via long-press; SR gets hidden text as
  normal DOM.
- **Effort: S–M**

### 9. The Marginalia Acrostic — Kael's notes have been hiding a word
On specific canonical days, the marginalia line is force-selected so its first
letter contributes to an acrostic across days (e.g. days 3, 7, 11…). Solvers
who read down the margin over a week assemble a passphrase; entering it in the
Security Gateway recovers a hidden Kael log revealing he was encoding messages
for whoever was paying attention ("A record is a way of asking someone to
look" — literally). Turns every modal footer into a slow-burn puzzle and every
open into potential evidence.
- **Build:** `ACROSTIC_OVERRIDES: Record<day, string>` beside the existing
  overrides in `kaelMarginalia.ts`; `checkAcrostic(input)`; one recovery id.
- **Effort: S** · Enormous "he was talking to *me*" payoff for tiny effort.

### 10. The Almost — near-miss at the window
The `window` panel occasionally shows something just leaving frame — a shape, a
light, gone before it resolves. Marginalia: "Did you see that? Tell me you saw
that." Rarely (seeded, with a pity timer so it always eventually lands) you do
catch it: a Focus Pull interaction where you track a drifting focus slider to
resolve one frame — a genuine story image, persisted. The most potent
return-driver in the set; the pity timer and meaningful catch keep it honest.
- **Build:** seeded per-visit RNG (near-miss vs. catch) + catch counter for the
  pity floor; CSS blur/opacity driven by a focus slider mapped to the existing
  (unused) `focusPull` roomFx channel; `markRecovered` on catch so it can't
  repeat hollowly.
- **Effort: M**

---

## Runners-up (strong, hold for wave 2)

- **Compass Triangulation** (community puzzle): every observer's daily bearing
  is secretly a ray from their assigned map cell toward one target — only 3+
  observers comparing notes can find where the rays converge and name Sector 03.
  The coherence thesis at social scale. Needs a real community first. (M)
- **Storm-reactive modals**: panels flicker/RGB-split when `stormDirector`
  fires — the modal is subject to the same weather as the room. Cheap and
  atmospheric; gate hard behind reduced-motion. (S)
- **Hold the Feed**: keep your pointer inside a wandering focal ring; the room
  behind the modal literally sharpens as you stay present. The thesis made
  literal. (S)
- **The Coffee for Two**: pour the second mug each visit; a quiet tally builds
  ("day 14, still two mugs"). The model for respectful ritual mechanics. (S)
- **Coherence-locked ghost text**: some confessions only render when coherence
  is CRITICAL — letting the room fall apart reveals what's underneath. (S–M)
- **Behavioral echo / escalation**: Kael references your own patterns ("You go
  for the papers before the monitors. Willow did too."). (M–L)
- **Something Brewing / Waking Panel**: appointment mechanics — a decode that
  finishes tomorrow; a night-feed panel only awake 02:00–05:00 with a rawer
  nocturnal Kael. Always bonuses, never gates. (S–M)
- **Dead-zone heartbeat Morse + Sector 03 naming capstone**: the void's
  sub-bass pulse encodes a code; the true sector name (from triangulation or
  Morse) is the only input the dead-zones panel won't swallow. (M)

## Shared scaffolding (build once, first)

1. **Promote `corruptClockString`** from `BreakRoomPanels.tsx` to a shared
   util — storm flicker, self-redacting docs, and instrument noise all reuse it.
2. **Persistent channels on the roomFx bus** (or a small `roomState` sampled by
   the shader) — powers #2 and the Variable Signal tell (#6).
3. **Recovery-id conventions**: `sign:day:*`, `fragment:*` pairs/sets,
   `lore:*`, `relay-frag-*` — agree on the namespace before wave 1.
4. **`originRect` threading** through hotspot handlers → `RoomModal` (#1).
5. **Marginalia override branches**: gap-aware (#3, #4) and day-forced
   acrostic (#9) both extend `kaelMarginalia.ts` the same way.

## Status

- **Wave 1 — SHIPPED 2026-07-03** (uncommitted): Signature Log (break-bulletin),
  Return Greeting, Marginalia Acrostic (answer: WITNESS, days 3/6/9/12/15/18/21,
  entered in Security Gateway), dog-ear/fingerprint read-traces, Coffee for Two,
  shared textCorruption util.
- **Wave 2 — SHIPPED 2026-07-03** (uncommitted): Origin Flight + header
  drag-to-dismiss, room-remembers traces (persistent `disturbed` roomFx channel →
  `uDisturbed` shader uniform + per-hotspot glow), FlipCard (Clipboard Archive
  back-side) + RevealMask (Observation Port condensation), storm-reactive modal
  flicker (`__storm.strike()` dev hook).
- **Wave 3 — SHIPPED 2026-07-03** (uncommitted): Signal Lock micro-game in
  cart-relay-tuning (transmissions rotate by day % 5; residue economy kept below
  a divider), Variable Signal (1–2 seeded featured hotspots/day, cool glow via
  `.hotspot-featured-glow`), Torn Halves (`pairId` on fragments: pair-carrier-note,
  pair-witness-dream) + "The Coherence Thesis" set with endowed slot
  (`lore:set-endowed:coherence-thesis`), The Almost in the Observation Port
  (pity floor 4 misses, catch = `lore:the-almost`, dev hook `__almost`).
- Wave 4 (community puzzles): not started.

## Suggested build order

- **Wave 1 — the quick wins (mostly S):** scaffolding, then #3 Signature Log,
  #4 Return Greeting, #9 Acrostic, dog-ears (#2a), plus Coffee for Two.
  One focused stretch; the daily-ritual + personalization spine goes live.
- **Wave 2 — the physical modal (M):** #1 Origin Flight, #2b room-render
  traces, #8 Hold-to-the-Light/FlipCard, storm-reactive flicker.
- **Wave 3 — the games & the pull (M):** #5 Signal Lock, #6 Variable Signal,
  #7 Torn Halves/Sets, #10 The Almost.
- **Wave 4 — community scale:** Compass Triangulation, dead-zone Morse,
  Sector 03 naming capstone — once there are enough observers to compare notes.

Every wave is independently shippable and nothing hard-blocks story progress.
