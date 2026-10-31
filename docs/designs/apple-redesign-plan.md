# Dip Alert: Apple redesign, build plan

Date 2026-10-31. Status: built. Owner picked direction A (Stocks), three tabs, and follow-device appearance. Comp and final captures are in `docs/design-refs/` locally (gitignored).

## Context

Dip Alert watches five assets and sends a WhatsApp message when Nifty crosses a new percent level below
its all-time high, or when a global asset moves past a daily threshold. Used by one person, mostly on a
phone, a few seconds at a time. There are no photos or brand lock-ins. All data is live and real.

The owner is scrapping the current "Liquid Glass" phone shell and wants it to look like Apple's own
interface: premium, modern, clean. Binding sources: the `apple-design` skill and developer.apple.com/design.

### What the current design gets wrong, measured against Apple's text

| Today | Apple's rule | Source |
|---|---|---|
| Glass hero card in the content layer | "Don't use Liquid Glass in the content layer." | HIG Materials |
| Decorative wallpaper behind everything | Glass belongs over content, and scroll edge effects "are not decorative" | HIG Materials, WWDC25 356 |
| Fake phone frame, fake status bar with an invented "97%" battery | Respect real safe areas; also breaks blueprint §12 (no invented numbers) | HIG Layout |
| One fixed 375px layout on every screen | Adapt by size class; tab bar becomes a sidebar on wide screens | HIG Layout, Sidebars |
| ALL-CAPS tracked labels everywhere | Text styles with title-style capitalisation | HIG Typography |
| Gold accent on buttons, line chart and badges alike | "Avoid using the same color to mean different things." | HIG Color |
| Asset chips and a watchlist on one screen doing the same job | Limit onscreen controls; show secondary details on demand | HIG Designing for iOS |
| Switches on the Alerts tab that actually navigate | A toggle "always lets people manage the state of something" | HIG Toggles |
| Dates such as `2026-07-22` | Plain language, "June 6" not "6/6" | HIG Charts |
| Hand-animated tab change on every switch | "Avoid adding motion to UI interactions that occur frequently." | HIG Motion |
| No apple-touch-icon, only an SVG favicon | Layered icon on a shared grid | HIG App icons, Icon Composer |

## Difference Test (blueprint §1.2)

Previous ledger row: Hungry Anna Ad 03 (documentary film). This project differs on all seven axes. Value
structure: follows the system, true black or iOS grouped grey. Chroma: monochrome plus Apple's semantic
green, red and blue. Type voice: San Francisco with size-specific tracking. Archetype: native list and
detail. Signature motion: physics you hold (sheet and chart scrub). Ornament: none. Domain chrome: the
alert ladder.

## Slop pre-check (blueprint §0.1)

- Generic fintech dashboard of stat cards: avoided, the home screen is a list and nothing else.
- Glass on everything: avoided, glass only on the tab bar, floating buttons and sheets.
- Fade-up on every element: avoided, nothing animates on arrival except a sheet you opened.
- Purple gradient: not present in A or C. Direction B carries colour on purpose, flagged there.
- Inter as a lazy default: used only as the fallback where San Francisco cannot legally be sent; every
  Apple device gets the real system font. Reason stated, not a default.
- Fake precision or invented numbers: every figure is computed from the live API.

## Sample ledger (blueprint §1.5)

| Sample | Feeds | Taken | Changed, and why | Tool |
|---|---|---|---|---|
| HIG `charts-stocks` (Apple's Stocks on iPhone) | Detail sheet | Sheet over black, grabber, glass round close and more buttons, big symbol with grey name on one baseline, hairlines, range capsule, trailing y-axis, area fade, three-column stats, "Market Closed" | Volume bars replaced by the alert ladder, because alerts are this app's point | Screenshot read directly |
| HIG `tab-bar-badges-iphone` | Tab bar | 62pt capsule, 4pt inner inset (concentric), selected capsule, filled icons, red badge | Three tabs instead of five | Measured from the image |
| HIG `charts-activity` | Segmented range, section headings | Bold section title, 26pt card radius, floating bar over content | Applied to the Alerts and Settings groups | Screenshot read directly |
| HIG `charts-descriptive-content` (Weather) | Chart headline | One plain sentence above the chart | "₹147 to next alert" replaces "Heavy Rain Forecasted" | Screenshot read directly |
| WWDC25 356 | Shapes, bars, sheets | Concentric radii, capsules for touch, soft scroll edge, blue checkmark as primary, sheet turning opaque as it rises | Web approximation with `backdrop-filter` | Transcript read |
| `apple-design` skill | All motion | Damping and response springs, velocity handoff, projection, rubber-band, press on pointer-down | Written as one small spring module, no animation library | Skill |
| HIG Color, Typography spec tables | Tokens | Exact system colour values, including increased contrast, and the SF tracking table | Hard-coded because the web has no system colour API | Extracted from Apple's JSON |
| SF Symbols, Icon Composer | Icons | Rules only: weight matches text, filled in tab bars, layered icon | The tools need a Mac, and SF Symbols are licensed for Apple platforms, so Tabler (MIT) is drawn to those rules | Page read |

Tool list (blueprint §1.6): Apple is the single source named by the owner and the §17.0 one-source rule
applies. Refero's MCP is not connected. Mobbin and the component registries were skipped on purpose,
because a third-party component would pull away from the system look this brief asks for.

## Direction: tokens taken from Apple, not invented

Colours, dark then light, from the HIG spec tables and UIKit: background `#000` / `#F2F2F7`, grouped
surface `#1C1C1E` / `#FFF`, tertiary `#2C2C2E` / `#F2F2F7`. Label `#FFF` / `#000`, secondary
`rgba(235,235,245,.6)` / `rgba(60,60,67,.6)`. Separator `rgba(84,84,88,.65)` / `rgba(60,60,67,.29)`.
Green `48,209,88` / `52,199,89`, red `255,66,69` / `255,56,60`, blue `0,145,255` / `0,136,255`, orange
`255,146,48` / `255,141,40`.

Small coloured text on white uses Apple's increased-contrast values (green `0,137,50`, red `233,21,45`),
because standard system green on white fails 4.5:1.

One job per colour: blue is interactive, green and red are price direction, orange is alert level.

Type, in rem so text size settings scale it: Large Title 34/41, Title 1 28/34, Title 2 22/28, Title 3
20/25, Headline 17/22 semibold, Body 17/22, Subhead 15/20, Footnote 13/18, Caption 12/16. Tracking follows
Apple's table per size. All numbers tabular. No light weights.

Font: `-apple-system` first, so iPhone and Mac get real San Francisco. Inter (OFL), self-hosted, is the
fallback on Windows and Android, because Apple's font licence does not allow sending SF to other systems.

Shape: capsules for controls, 26pt for groups, 38pt for sheets, inner radius = outer radius minus padding.

Appearance: follows the device, with no in-app switch (HIG Dark Mode says to avoid one). Honours reduced
motion, reduced transparency and increased contrast.

## UX intent (UX blueprint §8)

Value: know in two seconds whether anything needs doing. Psychology: a market app that sells calm, not
urgency. Principle to expression: the home screen never shouts, and the one number that matters (distance
to the next alert) is stated in words. Dark-pattern audit: no countdowns, no streaks, no pressure to buy.
"Buy on Groww" stays secondary and never sits next to a price movement as a nudge. Destructive actions
confirm with an alert that has a plain Cancel.

## Structure

Three tabs instead of four. **Watchlist** (list, tap for detail, add and edit live here). **Alerts**
(today's feed, past alerts and deployment summary, today split across Alerts and History but one dataset).
**Settings** (WhatsApp, check interval, access token, setup steps). Nothing is removed, only rehomed.

Phone: tab bar and sheets. Wide screens (1000px up): inset glass sidebar, list beside detail, detail is
inline instead of a sheet. Between: tab bar, with sheets as centred cards.

**The instrument (§8.3): the alert ladder.** Each level is a price and a rupee amount, with today's price
sitting between rungs. Only this app could show it. Computed from the live ATH, threshold and last alerted
level. Momentum assets get a centre-zero gauge from minus to plus threshold.

Ambition bar (§1.7): list = Apple Stocks plus scrubbed sparklines; detail = sheet with velocity handoff and
live chart scrub; ladder = cross-domain from Apple Weather's descriptive headline. None of these is a card row.

## Motion plan

Signature: **the sheet and the chart are physical.** Drag the sheet and it follows 1:1; let go and it keeps
your finger's speed. Drag the chart and the big price updates under your finger.

| Technique | Built with | Job here |
|---|---|---|
| Spring (damping, response) | `spring.js`, about 40 lines, replaces GSAP | Everything that moves, always from the live on-screen value |
| Sheet drag, velocity handoff, projection, rubber-band | Pointer Events plus spring | Open and dismiss detail; background pushes back with progress |
| Chart scrub | Pointer capture, direct DOM write | 1:1 price readout, also arrow keys |
| Range change | Resampled path, spring interpolated | Line morphs between 1M, 3M, 6M, 1Y |
| Tab lens | Spring with press-and-drag across the bar | Selected capsule travels and can be grabbed |
| Press states | CSS `:active`, instant | Feedback on pointer-down |
| Soft scroll edge | Masked `backdrop-filter`, shown only over content | Replaces hard dividers |
| Numeric roll | Per-digit CSS on change only | Price refresh every 60s, never on frequent actions |

Banned-list compliance: no fade-up on scroll, no stagger, no hover scale. Reduced motion: sheets and range
changes become short cross-fades; dragging still tracks the finger, because that is not vestibular.

## Files

Removed: `Wallpaper.jsx`, `wallpaperImage.js`, `liquidGlass.js`, `useLiquidGlass.jsx`, `GlassSurface.jsx`,
`GlassNav.jsx`, `gsap.js`, GSAP dependencies, Tailwind if nothing reads it, `index.css` rewritten.

Added under `frontend/src`: `spring.js`, `tokens.css`, `components/` (TabBar, Sidebar, Sheet, Chart,
Sparkline, Ladder, MoveGauge, GroupedList, Menu, Alert, Icon, Toast), `screens/` (Watchlist, AssetDetail,
Alerts, Settings, AssetForm).

Kept as is: `api.js`, `lib.js` pricing rules, `AssetContext.jsx` (plus sparkline history and range), all
backend code. No backend change is needed; `/history` already allows up to 365 days.

## Build order

1. Tokens, type and shell. 2. Static screens with live data, frozen gate. 3. Wide layout. 4. Motion, sheet
last. 5. App icon. 6. Reduced motion, transparency and contrast pass.

## Verification

Build, lint, typecheck, frontend and backend tests. Device matrix in blueprint §10: 1280x537, 1093x490,
1366x657, 1536x730, 1920x961, iPad both ways, 390x844, 360x740. Keyboard path. Both colour schemes.
Reduced motion. Per-step probe for sheet and scrub. `impeccable detect` at two viewports, taste pre-flight,
`web-design-guidelines`. Fact audit against `/api/status`.

Not verifiable here, and will be reported as such: real iPhone Safari (Dynamic Type, safe areas, touch feel)
and the running of Icon Composer, which needs macOS Tahoe.

## Open questions

None blocking. Still to check on a real iPhone: San Francisco, Dynamic Type, safe areas, touch feel. Icon Composer needs macOS Tahoe, so the layered `.icon` file is not built.
