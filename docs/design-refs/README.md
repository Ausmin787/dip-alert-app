# Design references

Screens captured from [Mobbin](https://mobbin.com) (free tier) on 2026-08-31, as input for the
UI gap fixes tracked in `CLAUDE.md`. **Reference only — not to be copied wholesale.** Each entry
below names exactly what we take and what we deliberately leave.

## How these were found

Free Mobbin gives roughly **one free result per filter**, so the technique is to vary the filter
rather than scroll. Filters that produced these:

| File | Filter used |
|---|---|
| `confirm-destructive-wise.png` | iOS → Flows → **Deleting & Removing** |
| `confirm-destructive-sheet-wise.png` | iOS → Screens → **Delete** |
| `confirm-patterns-comparison.jpg` | same as above, the unblurred result row |
| `asset-switcher-okx.png` | iOS → UI Elements → **Segmented Control** |
| `gold-local-currency-treasury.png` | free-text search: **`gold price`** |
| `content-cards-dark-moonpay.png` | free-text search: **`investment portfolio dashboard`** |
| `watchlist-borderless-tokenized.png` | free-text search: **`stock watchlist alerts dark`** |

URL shortcut (verified): `https://mobbin.com/search/apps/ios?content_type=ui-elements&sort=popularity&filter=screenElements.<Name>`.
Swap `content_type` to `screens` with `filter=screenPatterns.<Name>`, or `flows` with
`filter=flowActions.<Name>`. Use `/ios`, never `/web` — the web section is desktop SaaS dashboards
and the wrong form factor for this app.

**Free-text search works too, and the parameter is `q=`, not `query=`** —
`https://mobbin.com/search/apps/ios?content_type=screens&q=gold+price`. A wrong or invented
`filter=` value renders Mobbin's "Page not found", so if a filtered URL 404s, fall back to `q=`
rather than assuming the pattern doesn't exist. Free text is the better tool when you're after a
*domain* (gold, currency) rather than a *component*.

**Sorting trap worth remembering:** sorting Dialog by "Most popular" returns permission and promo
prompts (Venmo, Airbnb, Swiggy), not destructive confirms. The pattern-level filters above are what
actually find them.

---

## `confirm-destructive-sheet-wise.png` — the primary reference

Wise, "Delete card?" bottom sheet.

**Take:** the whole structure. Bottom sheet with a grip, short question as the title, one-line
consequence beneath (*"You can't undo this."*), destructive action as a **filled** button, escape
as an **outlined** button directly below it. Vertical stack, full-width buttons, destructive on top.

**Leave:** Wise's colours and type. Ours maps to `.sheet` + `.btn-danger` + `.btn-ghost` in our own
tokens.

**Why this one over a centred alert:** the app is already built on bottom sheets (`AssetSheet`), so
a centred iOS alert would introduce a second modal language for no gain.

## `confirm-destructive-wise.png` — the counter-example

Wise again, but "Are you sure? / You can reopen this balance whenever you want." as a **centred iOS
alert** with Cancel (blue, left) and Close balance (red text, right).

**The insight — this is the reason both files are here.** The same company uses two different
patterns in the same app, and the deciding factor is **reversibility**, not house style:

- Reversible → centred alert, destructive as *red text*, reassuring subtext
- Irreversible → bottom sheet, destructive as a *filled red button*, blunt subtext

**Take:** the reassurance principle. Our delete keeps alert history and the asset can be re-added,
so it is closer to reversible — the copy should say so, the way Wise says "You can reopen this
balance whenever you want." Our existing string already does this ("Alert history is kept").

**Leave:** the centred alert form itself, for the reason above.

## `confirm-patterns-comparison.jpg` — the survey

Five destructive-confirm treatments in one row: filled-red sheet (×2), centred dialog with a filled
red "Yes" over a muted "No", the iOS Cancel/Delete alert, and — notably — Instagram doing **no
confirm at all**, deleting immediately and offering a red "1 comment deleted. Tap to undo." banner.

**Take:** nothing directly, but keep it as the argument for why we chose a sheet. The undo-banner
approach is a legitimate alternative we are not taking, because our delete is a rare, deliberate
action rather than a high-frequency one where a confirm would nag.

## `asset-switcher-okx.png` — the chip strip

OKX crypto exchange. Contains **two** selector patterns on one screen, which is why it was chosen:

1. **Top — "Exchange | Wallet":** equal-width filled pill on a grey track. Good for 2–3 fixed options.
2. **Mid — "Favorites | Top | Hot | Gainers | New":** horizontally scrolling text tabs, no track and
   no pill. Selected is **bold + full-contrast**, unselected are **regular weight + muted**.

**Take:** pattern 2. Our five assets have very uneven label lengths ("Nifty 50", "Gold (COMEX)",
"S&P 500"), which an equal-width pill handles badly and variable-width text tabs handle naturally.
Critically, its selected state is marked by **weight as well as colour**, so it does not rely on
colour alone — which matters because gold is already our accent everywhere else.

**Leave:** OKX's light theme, and their filled red/green percentage pills. We use coloured text for
change values (`.chg-up` / `.chg-dn`) and should stay consistent with the rest of the app.

**Also note:** OKX puts the change on the right edge of each row, same as our `WatchlistMini`
already does. Confirms that layout rather than changing it.

**Second take, added later — the currency lesson.** OKX prices BTC as **`Rp983,265,397`**. A
globally-quoted asset shown in the *reader's* currency, not the asset's. That is the seed of the
`priceParts` work below.

## `gold-local-currency-treasury.png` — Indian-context metal pricing

Treasury, an Indonesian gold-savings app. Prices gold as **`Rp2.301.436 / gram`**.

**Take:** the whole idea. Gold is quoted globally in USD per *troy ounce*, and Treasury shows it in
the local currency **and the local unit** — rupiah per gram, because that is how Indonesians buy
gold. Our equivalent is ₹ per **10 g** for gold and ₹ per **kg** for silver, which is how Indian
jewellers and MCX quote them. Converting to ₹/oz would have been a rupee number in a unit no Indian
uses; converting the unit as well is what makes it read as a domestic price. Note also that the
unit rides as a **muted suffix** after the bold value (`Rp2.301.436` + ` / gram`) — that is exactly
`.hunit` / `.wp-unit`.

**Leave:** Treasury's buy/sell spread and the "your gold in grams" holdings model. We are a price
watcher, not a broker — we have no position to value.

**The honesty constraint this reference does NOT solve.** Treasury is a dealer quoting its own real
transactable price. Ours is a *derived* number: COMEX USD/oz × a Yahoo spot rate. Indian physical
gold additionally carries ~6% import duty and 3% GST, so our figure sits roughly 10% below the
actual counter price. Two rules follow, both implemented and both worth keeping:

1. The exact rate used is printed next to the value (`@ ₹94.93/$`) — borrowed from Wise's
   "Using this exchange rate ×1.1723" row in the `currency conversion rate` search.
2. The caveat is stated in the card, not buried: *"International equivalent · excludes duty & GST."*
   Never relabel these as MCX or jeweller rates.

**Deliberately not converted:** `^GSPC` / `^NDX` are index *levels*, not prices. There is no
meaningful rupee value for "29,448 points", so they show `pts` as a unit instead. Historical alert
rows are also left in their native currency — converting a past price at today's rate would invent
a number that was never true.

## `content-cards-dark-moonpay.png` + `watchlist-borderless-tokenized.png` — the de-glassing references

Five dark finance apps (MoonPay, an account dashboard, Tokenized Stocks, Alert Preferences, a
search/watchlist screen). These are the evidence behind the 2026-09-01 material-tier rework, which
cut the app from 14 glass cards to 4 glass surfaces.

**The observation that drove it: not one of these uses glass for content.** Every one is
(a) a calm flat background, (b) section headers as **plain text on that background**, not inside a
card, (c) solid content cards for composed objects, (d) borderless rows for lists. Their "rich,
modern" quality comes from typography, spacing and colour-coded icons — from *removing* material,
not adding it.

**Take, specifically:**
- The hero figure sitting **directly on the background** with no card (MoonPay's "Total value /
  $0.00"). We keep our hero card because the user asked for it, but this is why nothing *else*
  gets a card by default.
- Plain-text section headers → our `.sec-hd`.
- The borderless watchlist row — icon, name, muted sub-line, right-aligned price with the change
  beneath it — → our `.sec.wlist` / `.wr`. Tokenized Stocks is almost exactly our data shape.
- The grouped-settings pattern (Alert Preferences: "Subscribed / Organizations" as a bare header
  over solid rows with chevrons) → our AlertsTab `ConfigRow` card.

**Leave:** their flat near-black backgrounds. We keep the wallpaper — it is the app's identity —
and calm it with `.content-scrim` instead, so the hero still has something to refract.

**The rule we derived (now in CLAUDE.md as the material tiers):** a group earns a *card* only when
it is a single composed object you read as one unit; a homogeneous scannable list gets a bare
section; glass is reserved for the functional/floating layer. This matches Apple's *Adopting Liquid
Glass*: "This material forms a distinct functional layer for controls and navigation elements",
"Avoid overusing Liquid Glass effects… Limit these effects to the most important functional
elements in your app", and "avoid overcrowding or layering Liquid Glass elements on top of each
other."
