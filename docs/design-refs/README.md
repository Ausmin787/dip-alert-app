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

URL shortcut (verified): `https://mobbin.com/search/apps/ios?content_type=ui-elements&sort=popularity&filter=screenElements.<Name>`.
Swap `content_type` to `screens` with `filter=screenPatterns.<Name>`, or `flows` with
`filter=flowActions.<Name>`. Use `/ios`, never `/web` — the web section is desktop SaaS dashboards
and the wrong form factor for this app.

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
