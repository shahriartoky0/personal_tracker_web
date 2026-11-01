# Design brief

**Audience:** one person managing daily cash/bank/mobile-wallet money, mostly on a phone.
**Primary task:** know "Left for today" at a glance and log an expense in a few taps.
**Direction:** calm, trustworthy, restrained. Warm off-white neutral base, one deep-teal accent, semantic success/warning/destructive. No gradients, glass or decorative charts.
**Type:** Inter 400/500/600/700 (+ Noto Sans Bengali fallback). Scale tokens: `.text-display` (hero number), `.text-title`, `.text-section`, `.text-value`, `.text-label`, `.text-caption`. Money uses `.num` (tabular numerals).
**Spacing/shape:** Tailwind 4px scale, `--radius: 0.5rem`, 44px minimum touch targets (`.tap`).
**Status vocabulary:** Planned · Spent · Unplanned · Left for today · Over budget. Colour is never the only cue (icons, text, signs).
**Breakpoints:** 640 / 768 / 1024 / 1280. Phone = single column, bottom nav, floating Add Expense, bottom sheet. ≥768 = side sheet. ≥1024 = persistent sidebar, tables, two-column analytics.

## Wireframes (screen → mobile layout)

- **Home:** greeting → hero card (Left for today, progress, Planned/Spent/Unplanned) → balance + month stats → today by category → 7-day bars → recent transactions.
- **Plan:** day switcher → limit + allocation editor (live allocated/left) → copy/template/save → day review + close → planned expenses.
- **Add (sheet):** type toggle → amount (large) → category chips → planned/unplanned → account + date/time → title/note → sticky Save.
- **History:** filters (search, dates, category, account, planned) → date-grouped cards (table ≥768).
- **Reports:** period presets + custom range + filters → summary cards → unplanned callout → donut, trend, planned vs actual → comparison, payment methods, top merchants → export.
- **Settings:** tabs — Profile, Accounts, Categories, Reminders, Data & security.

## Verification log

`scripts/responsive-check.mjs` run against `/demo`, `/login`, `/signup` at 360×800, 390×844, 430×932, 768×1024, 1024×768, 1366×768, 1440×900, 1920×1080: no horizontal overflow; axe (WCAG 2.0/2.1/2.2 A/AA) reports no violations at 390 and 1440. Screenshots are in `docs/screenshots/`. Signed-in screens still need a manual pass once a Supabase test account exists (zoom 200%, keyboard-only flow, touch emulation).

Note: the Anthropic *frontend-design* skill was not available in the build session, so it was **not** used; the brief above was written by hand. See README for the install command if you want a design review pass with it.
