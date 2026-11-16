# Reports (append only)


## B0 + B1 (HACK-BACKEND, 13:33): every contract function deployed, h3 loads in Convex
- New files in `convex/`: `config.ts` (`config.public`), `cells.ts` (`all`), `grid.ts` (`around`), `shops.ts` (`list`), `events.ts` (`forMe`, `recent`), `season.ts` (`end`), `rewards.ts` (`mine`, `redeem`), `admin.ts` (`seedShops`, `reset`), `leaderboard.ts` (`top`), `payments.ts` (internal `chargeShopFee`, `checkFee`: **stubs until B5**). `walks.ts` gains `last` and `preview`.
- These are real implementations, not empty stubs, with explicit return types matching contract v3, so the frontend gets exact types from `api`. Contract shapes unchanged. View types are exported for the frontend if useful: `CellView` (cells.ts), `ShopView` (shops.ts), `EventView` (events.ts), `RewardView` (rewards.ts), `SubmitResult` (lib/rules.ts).
- `config.public`: `public` is a reserved word in JS, so it is declared as `publicConfig` and exported as `public`; the client calls `api.config.public` as the contract says.
- Removed every `any` cast in `walks.ts` and `players.ts` (real `Doc`/`Id` types now).
- Verified: `npx tsc -p convex --noEmit` clean; the running `convex dev` regenerated `_generated/api.d.ts` with all modules; `npx convex run config:public` returns the real config; `cells:all` returns `[]`; `npx vitest run`: 29/29 pass.
- B1 grid proof: `npx convex run grid:around` at VENUE returns 127 hexagons (6 rings) with 6-point boundaries; `walks:preview` on a 150 m square returns 11 blocks (spec table: 9 to 11). `GRID` stays `"h3"`. No temporary query was added.
- Untested so far: shops/season/rewards/events end to end (T2-T7, T9-T11 tests come in B2-B6). Payments do nothing yet.
- Note: my earlier `convex/lib.ts` (Prompted) is gone from `convex/`; I assume LEAD moved it to `.team/on-hold/`.

## F0: theme, fonts, Button/GlassCard/Card/Pill/Toast, Convex provider (HACK-FRONTEND, 13:52)
- `src/theme.ts`: spec 5.1 tokens word for word, plus `size`, `motion`, `opacity`, `blur` so screens have no raw numbers.
- `src/app/_layout.tsx`: loads Space Grotesk 600/700 and Inter 400/500/600 with per-weight imports (only 5 .ttf in the bundle, not all 30). Shows a plain `bg` screen until loaded, carries on with the system font on error or after 4 s. `ConvexProvider` with `EXPO_PUBLIC_CONVEX_URL`; if the var is missing it shows "Lasso can't find its server." instead of crashing. `ToastProvider`, light status bar, headerless Stack on `bg`.
- `src/components/`: `Button` (primary/secondary/ghost/danger, 56/44, scale 0.97 over 90 ms + light haptic, spinner keeps width, 40% disabled), `GlassCard` (BlurView 40 dark over `glass`), `Card` (optional gold left edge), `Pill` (neutral/accent/danger/reward/player colour), `Toast` (`useToast().show()` 3 s, `.error()` stays until "Dismiss").
- `src/app/index.tsx` is a temporary F0 showcase screen (all components + a live `players.list` count); F1 replaces it with Join/Home.
- Removed template `src/app/explore.tsx`, `src/components/app-tabs.tsx`, `app-tabs.web.tsx`. Other template components are untouched and unused.
- Checked: `npx tsc --noEmit` clean; `npx expo export --platform ios` builds (2.9 MB bundle, output in my scratchpad, nothing written to the repo).
- Not checked on a device (no Revyl loop yet). Human check: none needed for F0.

## B2 + B3 + B4 + B6 (HACK-BACKEND, 13:36): capture, steal, flags, shops, season, rewards, reset all tested
- No new functions were needed (all written in B0). This milestone is verification.
- New test file `convex/api.test.ts` (5 tests) drives everything through the public `api`. I made it a separate file, not an extension of `game.test.ts`, to leave the kit file untouched. It covers T1, T2, T3, T8 (plus `walks.last` skipping rejected walks and `leaderboard.top`), T11 (`byFlag` frozen, `ownerFlag` live), T4 + T10 (shop minimum note; `seedShops` twice keeps count 1, updates by name, skips a second shop in the same block), T5 (fake timers: A holds 1 h, B takes it, `shops.list` shows B as holder and A first in `top` with about 1 h; `season.end` gives one reward to A, a second call gives 0; `rewards.mine` shape), T6, T7 (too_far, demo ok with `feeStatus: "pending"`, then already_redeemed) and T9 (`admin.reset` clears cells/events/rewards, keeps players and shops; a new season can end again).
- `npx vitest run`: 34/34 pass. `npx tsc -p convex --noEmit` clean.
- Untested: the live Whop call (B5, next). `grid.around` was checked by hand on the deployment in B1.
- Created `hackathon.md` at the repo root with the sponsor uses LEAD sent (Convex deployment, Whop env vars, Capy thread). If the Convex hackathon skill PR later creates its own `hackathon.md`, keep this content.

## F1: Join and Home with the dark map and position or venue fallback (HACK-FRONTEND, 14:12)
- Routing: `src/app/index.tsx` sends a stored player to `/home`, else `/join`.
- Identity `src/lib/player.tsx`: random `deviceId` in AsyncStorage, active player `{playerId, name, color, flag}` in context and AsyncStorage (ready for Switch player in F2). Home re-syncs name/colour/flag from `players.list` and sends you back to Join if your player is gone.
- Join `src/app/join.tsx`: "Lasso", tagline, "Nickname" (max 16), six swatches (labelled "Colour 1".."Colour 6" for Revyl), optional `FlagField` (counter from `config.maxFlagChars`), "Start" disabled until a nickname. Start calls `players.join` (flag left out when empty), then asks foreground location permission, then Home. Errors show the ConvexError sentence under the button.
- Home `src/app/home.tsx`: full-screen dark `react-native-maps` map (Android gets a dark `customMapStyle`), cells from `cells.all` drawn already (45%/65% fill, 1.5/2.5 stroke, keyed by cellId), player chip (dot, name, "N blocks"), camera follows you until you drag, then "Recenter". "Using the venue as your location" pill when there is no fix after 8 s or permission is denied in demo mode. "Reconnecting…" pill when the Convex socket is down. Denied permission outside demo mode: "Lasso needs your location to record walks" + "Open settings". Card shows "Walk a loop to claim your first blocks." (target card proper is F5). "Start walk" goes to a placeholder Walk screen (F3).
- Components added: `PlayerDot`, `Skeleton` (shimmer, off with Reduce Motion), `FlagText`, `FlagField`, `LassoMap`.
- Checked: `npx tsc --noEmit` clean, `npx expo export --platform ios` builds. Not run on a device yet.
- Human check on a phone: Join with a nickname, allow location, see the blue dot on the dark map on two phones; deny location on one and check the venue pill (demo mode) or the settings card.

## B5 code done, live check blocked on WHOP_SHOP_EMAIL (HACK-BACKEND, 13:50); B6 + B7 done
- `convex/payments.ts`: `chargeShopFee` (internal action) runs create invoice, then issue, then saves `feeStatus: "invoiced"` + `whopInvoiceId`, then schedules `checkFee` every 15 s, up to 40 times, which sets `"charged"` when Whop says `paid`. Any non-2xx or throw gives `feeStatus: "failed"` + `feeError` (status + first 300 chars) + `console.error`, and it never throws. Idempotency keys are `lasso-invoice-<rewardId>` and `lasso-issue-<rewardId>`. It pins the `Api-Version-Date: 2026-11-14-1` header. The base URL defaults to sandbox and only `WHOP_API_BASE` overrides it; `WHOP_ENVIRONMENT` is ignored on purpose.
- Docs checked (docs.whop.com plus the public OpenAPI spec): `initial_price` is in dollars ("5.00 means $5.00"), so `feeCents / 100`. An inline variant needs no product.
- **Spec gap:** the issued invoice's `checkout_link` is a signed token, not an openable URL. The docs say "pass it as `link` to `POST /checkout_sessions`", but that endpoint is not in the public spec. The code tries it best effort and stores `purchase_url`/`url` as `feeUrl` if it works. If not, the fee is still `invoiced` with `feeUrl: null`. FRONTEND must handle `invoiced` + `feeUrl === null` (e.g. "Invoice sent to Blue Door"). The function logs show which case happened on the first live run.
- Env on the deployment: `WHOP_API_KEY`, `WHOP_ACCOUNT_ID` set. **`WHOP_SHOP_EMAIL` missing.** Until it is set, every redeem stays `pending` (the spec's accepted fallback, "Blue Door owes $1.00"). The owner sets it with `npx convex env set WHOP_SHOP_EMAIL <inbox>`.
- Ops helper: `npx convex run payments:retry '{"rewardId":"<id>"}'` re-sends a fee stuck in `pending` or `failed` (fresh idempotency keys).
- Verified: tsc clean (declared `process.env` locally, since @types/node is not installed); 34/34 tests pass (T6, T7 cover redeem; the scheduled action no-ops in tests with no env).
- B6 (`admin.reset`: T9; `grid.around`: manual call in B1) and B7 (`leaderboard.top`: in api.test.ts; `walks.preview`: manual call in B1) were done earlier and are verified.
- Not done yet: one live redeem showing `invoiced` + link (needs `WHOP_SHOP_EMAIL`). After that I stay available for tuning and hackathon.md.

## F2: cells, Demo tools (Fake loop, Add test player, Switch player and the rest), Result without animation (HACK-FRONTEND, 14:40)
- Cells were already drawn in F1 (`LassoMap`, live from `cells.all`, keyed by cellId), so a fake loop on one phone shows on every phone as soon as Convex pushes.
- Demo tools `src/app/admin.tsx` (full-screen modal): opened by holding the player chip for 2 s, or the "Demo tools" button top right when `demoMode`. Sections: Acting as (+ "Switch player" list from `players.list`, "Add test player" form with Nickname, colours, flag, joins as `<deviceId>#<nickname>` and switches to it); Fake loop ("Around: Here" + "Around: <shop>" chips, "Fake loop: small" 130 m / "Fake loop: large" 200 m via `squareLoop`, submits as the active player, opens Result); built ahead of F5-F7: "Seed venue shops" (`assets/seed-shops.json`), "Seed shops from JSON" (validated), "End the week" (toast "Week ended. N rewards created."), "Demo redeem" toggle (demo mode only), "Reset map" with in-panel confirm "Clear every block, walk and reward?" / "Reset" / "Cancel". Every action toasts its result; errors show the ConvexError sentence.
- Result `src/app/result.tsx`: captured shows the map fitted to `claimedCellIds`, "BLOCKS CLAIMED" StatNumber, "You claimed 7 blocks with a 9-block loop." or "No new blocks this time.", the stolen line, each note in muted text, the "Plant a flag on your new blocks" prompt when I have no flag, "Back to map". Rejected shows an EmptyState with the spec sentence per reason. No capture animation yet (F7).
- New: `StatNumber`, `EmptyState`, `src/components/icons.ts` (per-icon lucide imports; importing `lucide-react-native` directly added 2.4 MB to the bundle), `src/lib/store.ts`.
- Checked: tsc clean for `src/`; `npx expo export --platform ios` builds, 3.3 MB.
- **LEAD, please:** root `tsc --noEmit` now fails on `screen/` (react-leaflet, leaflet, @vitejs/plugin-react, react-dom/client types), because the root `tsconfig.json` include `**/*.tsx` picks up `screen/` and it has its own tsconfig. Add `"exclude": ["screen", "web", "node_modules"]` to the root `tsconfig.json` (not my file).
- Human check: on phone A open Demo tools, "Fake loop: small"; cells colour on phone B within a second. Hold the chip 2 s to open the panel. Switch player, then Fake loop again.

## B5 follow-up: checkout_link research + email fallback (HACK-BACKEND, 14:00)
- Checked again for the `checkout_link` exchange. Whop's public spec (api.whop.com) and sandbox spec (sandbox-api.whop.com) both have no `POST /checkout_sessions` path. Checkout sessions do exist in their schema (`chs_` ids in webhooks). The spec the docs pages cite (`docs.whop.com/openapi/api-v1-native.json`) is behind a Whop login. So the docs cannot settle it; the first live run's log will. Worth asking the Whop team: "How do I get a buyer-openable URL from an issued invoice's `checkout_link`? Is `POST /checkout_sessions { link }` available in sandbox?"
- Added a fallback in `payments.chargeShopFee`: when no openable URL comes back, it calls `POST /invoices/{id}/send`, which emails the invoice and its pay link to `WHOP_SHOP_EMAIL`. Paying from that inbox with a sandbox test card is picked up by `checkFee` and shown as `charged`. Best effort: a send failure leaves the fee `invoiced`.
- Demo path either way: redeem, fee shows `invoiced` (with a link if Whop gives one), a teammate pays from the link or the email, and within 15 s it shows `charged`.
- hackathon.md: logged Capy PR #1 (merged `0b165fb`) and the Revyl/Capy thread `jam_01M7GJQ2EMP958N7KZH3R03BE1`.
- tsc clean, 34/34 tests pass. Files changed: `convex/payments.ts`, `hackathon.md`.

## F3: Walk screen with real tracking, HUD, auto-close, Close loop, cancel, pause, retry (HACK-FRONTEND, 14:58)
- `src/app/walk.tsx`: `watchPositionAsync({ accuracy: High, timeInterval: 2000, distanceInterval: 5 })`, drops points under 1 s apart (iOS ignores timeInterval), stores `{lat, lng, t: location.timestamp, acc: accuracy ?? 10}`. Points with acc > 50 are sent but not drawn. Lime 5 px round path, `Flag` pin on the first drawn point, camera follows until dragged, then "Recenter". `useKeepAwake`.
- HUD: "WALKED" StatNumber + progress bar + "Keep going. A loop needs at least 150 m." (from `minLoopM`), then "Return to the flag to close your loop. 85 m to go." "Weak GPS signal. Stay in the open." pill when the last acc > 25. "No GPS signal yet. Stay in the open." after 8 s with no point.
- Auto-close: length >= `minLoopM`, has been > 2 x `closeRadiusM` from the flag, now within `closeRadiusM`: success haptic, then submit. "Close loop" primary once long enough.
- Submit: spinner + "Counting your blocks…"; 10 s timeout or network failure keeps the points and shows "Couldn't reach the server." + "Try again" (a ConvexError shows its own sentence). Success clears the saved walk and opens Result.
- "Cancel" (top left) asks in-screen "Discard this walk?" with "Discard" / "Keep walking". Background stops recording; on return "Walk paused. Keep Lasso open while you walk." with "Resume" (same path) / "Discard". Points saved to AsyncStorage every 10 points and on pause (`src/lib/savedWalk.ts`).
- Built ahead for F7: Walk accepts a pending walk to resume or replay (replay draws at 10x and submits with timestamps shifted to now). The Home "Resume your walk?" prompt and the Demo tools "Replay last walk" button come in F7.
- Checked: root `npx tsc --noEmit` clean (exit 0), iOS export builds at 3.3 MB. Not run on a device.
- Human check outside: Start walk, walk a ~150 m loop back to the flag; it should auto-submit and show Result. Also try Cancel, backgrounding the app, and airplane mode on close (expect "Couldn't reach the server." and "Try again" working once back online).

## F4 + F4b + F5 + F6: steal banner, flags, shop pins, target card, Shops screen, redeem (HACK-FRONTEND, 15:24)
- F4 steal banner (`src/lib/stealBanner.ts`, `src/components/Banner.tsx`): newest `events.forMe` item newer than the last one dismissed; the dismissed `createdAt` is stored per player in AsyncStorage, so after Switch player the other player's banner shows. "Sam took 3 of your blocks with a 9-block loop. Enclose 10 to take them back." + "They now hold Blue Door." when `shopName` is set. Danger variant (3 px red edge), slides down over 350 ms, the screen edge pulses red once, heavy haptic once per new event. "Dismiss" hides it.
- F4b flags: `FlagText` (curly quotes, owner colour, 2 lines), `FlagField` on Join, Add test player and Result; Home flag chip under the player chip shows my flag on one line or "Add a flag" and opens `FlagSheet` ("Your flag" field, "Save" calls `players.setFlag`, ghost "Remove" sends ""). Tap a block: card above the target card, "Sam's block, held with a 7-block loop" / "Your block, held with a 7-block loop" + owner flag; tapping the map elsewhere closes it. Banner with `byFlag`: "…with a 9-block loop: “thanks for the coffee”. Enclose 10…" with the flag in the taker's colour.
- F5: shop pins (`ShopPin`: 36 px, gold border, lime when I hold it, Store icon, name pill, keyed by shopId). Target card picks the nearest shop to my position (venue fallback): held by someone else / unheld / "You hold X with a 7-block loop." + "Held for 2 h 10 min" (refreshed every 30 s) / "Walk a loop to claim your first blocks." Reward in gold, number to enclose in lime. "Shops" button beside the card title with a gold dot when I have an unredeemed reward. Shops screen `src/app/shops.tsx`: "Shops" header + close, "YOUR REWARDS" and "ALL SHOPS" with the empty sentences, held-time rows (holder gets `now - holderSince` added, sorted, top 3). End the week, Seed venue shops and Fake loop around a shop were already in Demo tools (F2). Happy Cow is the nearest shop to the venue (about 200 m), so the lasso-reward test's "You hold Happy Cow Creamery & Tea" works on the cloud device.
- F6: "Redeem" enabled within `redeemRadiusM` or when the Demo redeem toggle is on, else disabled + "Go to X to redeem."; sends `demo: true` with the toggle; too_far / already_redeemed sentences; after redeem "Redeemed." in green + fee line (owes / was invoiced / paid / "Fee could not be charged."); "Open invoice" only when `feeStatus` is invoiced, `feeUrl` is not null and demo mode. Reward card scales 0.9 to 1 with the code fading in plus a success haptic, once per reward per session.
- Fixed LEAD's note: `FlagSheet` no longer uses `StyleSheet.absoluteFillObject`.
- Checked: root `npx tsc --noEmit` exit 0; iOS export builds (3.3 MB). Not run on a device.
- Human check: phone B takes blocks from phone A, so A sees the banner and a heavy buzz; B's flag shows in A's banner and when tapping B's blocks. End the week, then the winner's Shops screen shows the code; Redeem with Demo redeem on shows "Redeemed." and a fee line.

## F7: Replay, capture animation, Reset map, saved-walk resume (HACK-FRONTEND, 13:55 by the machine clock)
- Correction: the times in my F1 to F6 headings (14:12, 14:40, 14:58, 15:24) were wrong; I wrote them without reading the clock. This one is the real time.
- Demo tools "Replay last walk": loads `walks.last` for the active player and opens Walk drawing the path at 10x, then submits the same points with timestamps shifted so the last is now (as the active player). No captured walk: error toast "<name> has no captured walk to replay yet."
- Capture animation on Result (`src/lib/captureAnimation.ts`): claimed cells fade 0 to 65% fill 60 ms apart (stagger shrinks for big loops so the total stays near 800 ms), then the BLOCKS CLAIMED number counts up from 0; medium haptic at the start. Reduce Motion shows the end state.
- Walk: on loop close (auto or "Close loop") the path flashes wider for 300 ms with the success haptic.
- Home "Resume your walk?" with "Resume" / "Discard" when a walk for this player was saved under 30 minutes ago (saved every 10 points and on pause; cleared on submit or discard).
- "Reset map" with its in-panel confirm was already in F2.
- Checked: root `npx tsc --noEmit` exit 0; iOS export builds (3.3 MB). Not run on a device.
- Human check: walk a real loop, then Demo tools > "Replay last walk" indoors runs start to finish and shows Result. Kill the app mid-walk (after 10+ points) and reopen: "Resume your walk?" appears.

## F8: polish pass against section 5 (HACK-FRONTEND, 13:57)
- Every button now has visible words: the Demo tools and Shops header close buttons were icon-only; they are now `CloseButton` (X icon + "Close").
- Scan of `src/app` and `src/components`: no hex codes, rgba or font sizes outside `theme.ts` (the flag chip's 240 px max width became `size.chipMax`).
- Reduce Motion now covers every animation: Skeleton shimmer, banner slide, red edge pulse, capture fade and count-up, reward card, and the button press scale.
- Removed the unused Expo template files (animated-icon, external-link, hint-row, themed-text/view, web-badge, ui/collapsible, `src/constants/theme.ts`, `src/hooks/*`, `src/global.css`); nothing imported them. `src/` is now only Lasso code.
- **LEAD (app.json, not my file):** the splash `backgroundColor` is still the template blue `#208AEF` and the Android adaptive icon background is `#E6F4FE`. For the Night map look, set both to `#07070A` (`color.bg`).
- Checked: root `npx tsc --noEmit` exit 0; iOS export builds (3.3 MB). Not checked on a device (Revyl loop not up).
- Human check: open each screen on a phone and look for clipped text on the target card and banner (3 lines max) and the flag chip.

## F9: stretch - Top walkers, faint grid, walk preview (HACK-FRONTEND, 14:00)
- Shops screen: "TOP WALKERS" card from `leaderboard.top` (rank, PlayerDot, name, "N blocks"), hidden when empty.
- Home: faint outlines of unclaimed blocks from `grid.around` (1 px `border` colour, no fill, not tappable, drawn under owned cells). The query position is rounded to about 100 m, so it does not re-query on every GPS tick.
- Walk HUD: after the loop is long enough, "Closing now takes 7 blocks" in lime from `walks.preview`, re-queried at most once every ten new drawn points; hidden until the first answer and when 0.
- Checked: root `npx tsc --noEmit` exit 0; iOS export builds (3.3 MB). Not run on a device.
- Human check: the Home map shows a faint hex grid around you; outdoors the walk HUD shows the "Closing now takes" line after about 150 m.
- All milestones F0 to F9 are delivered. I'm waiting for bug reports from the phone tests and Revyl.

## B5 live run (HACK-BACKEND, 14:05): invoice created, issue blocked by Whop account verification
- Steps on fantastic-crocodile-610: `admin:seedShops` with `assets/seed-shops.json` (4 shops); joined test player "Backend Test" (deviceId `backend-live-test`); walked a 200 m square around Happy Cow Creamery & Tea (captured, strength 19, it became the holder); `season:end` gave 1 reward (code MK6FRN); `rewards:redeem` with `demo: true` returned `{ ok: true }`.
- Run 1: `failed`. Whop's 400: "Title is too long (maximum is 30 characters)". Fixed: the variant title is now "Lasso redemption fee" and the shop name goes in the item `description`.
- Run 2 (`payments:retry`): **invoice created, `pay_VMhcQG436HwYZF`**, status draft, total `{"amount":"1.00","currency":"usd"}`, so dollar units are confirmed. **Issue refused:** `400 invoice_account_verification_required`, "Complete account verification before issuing an invoice". The status stayed `failed`. Neither feeUrl nor the email fallback was reached (both come after issue).
- **Owner action needed:** complete account verification for the sandbox business in the Whop sandbox dashboard (sandbox.whop.com), or ask the Whop team on the floor to verify or waive it for the sandbox account. Nothing in our code can get past this.
- Code change: on an issue failure the invoice id is now saved, and a retry re-issues that same draft instead of creating another.
- Then `admin:reset` as asked: 0 cells, rewards cleared, 4 shops kept. The player "Backend Test" remains (reset keeps players by design); it shows in the admin Switch player list.
- To re-run once verification is done (about 1 minute): same steps (join, a 200 m loop around a shop, `season:end`, redeem with demo). Note for anyone scripting it: `npx convex run` with a long walk JSON fails on Windows ("The command line is too long"); use `node node_modules/convex/bin/main.js run ...` instead.
- hackathon.md logs the invoice id and the verification block (no email address in it). tsc clean, 34/34 tests pass. Changed: `convex/payments.ts`, `hackathon.md`.

## HACK-BACKEND: Revyl logged in hackathon.md
- Revyl section: Revyl app "Lasso", build `remote-8f24f156` built by Capy on Revyl's runners; the 3 smoke tests on a cloud iPhone 16 (iOS 27) at 14:40-14:54 with report links (capture 8/8 passed, steal 9/9 steps passed but session marked failed, reward 12/12 passed), the shareable capture link, proof of changes (PR #2, `807f693`), and the backup EAS cloud simulator build `6f89b0dc` (Expo project `yc-hackathon`).
- Capy section: PR #2 merged as `807f693`. Timeline: 14:40-14:54 entry added.
- Whop entry unchanged (invoice `pay_VMhcQG436HwYZF`, issuing blocked by sandbox account verification). No email address in the file (checked).
- File to commit: `hackathon.md`.

## HACK-BACKEND: B8: contract v4 points, exchange, vouchers, wallet, stats (done)
- Deployed on fantastic-crocodile-610 (function-spec confirms): `wallet.mine`, `offers.list`, `offers.exchange`, `vouchers.use`, `stats.mine`, `leaderboard.points`, `admin.grantPoints`; `SubmitResult.pointsEarned`; seedShops creates 2 offers per shop with none; reset deletes ledger and vouchers and sets every player's points to 0 (offers stay).
- Schema: `players.points` (optional), `ledger`, `offers`, `vouchers` with the indexes in the spec. Config: `POINTS_PER_10M = 1`, `POINTS_PER_BLOCK = 10`. Pure rule `walkPoints` in `lib/rules.ts`; `lib/ledger.ts` `addPoints` writes the balance and one ledger row together.
- Walk ledger reason: `"Walk: <claimed> blocks, <rounded m> m"` (claimed blocks, the same number the points use).
- Tests: new `convex/points.test.ts` (4 tests: points formula; walk points + ledger + rejected 0; exchange not enough then enough, voucher too_far / ok / already_used, points leaderboard, reset; steals in stats). `npx tsc -p convex --noEmit` clean, `npx vitest run` 38/38.
- Live: re-ran `admin:seedShops` with assets/seed-shops.json, so there are now 8 offers (a free item for 300 and "10% off your order" for 100 at each of the 4 shops).
- Files to commit: convex/schema.ts, convex/lib/config.ts, convex/lib/rules.ts, convex/lib/ledger.ts, convex/walks.ts, convex/admin.ts, convex/leaderboard.ts, convex/offers.ts, convex/vouchers.ts, convex/wallet.ts, convex/stats.ts, convex/points.test.ts, convex/_generated/api.d.ts, hackathon.md.

## F10: Menu panel and every menu screen, Result points line, chip balance (HACK-FRONTEND, 15:33)
- **LEAD, Revyl yaml needs an update:** the top-right "Demo tools" button moved into the Menu panel (as v4 asks), so every step that says "Tap 'Demo tools'" from Home must now read "Tap 'Menu', then tap 'Demo tools'": lasso-capture.yaml line 15, lasso-reward.yaml lines 13 and 23, lasso-steal.yaml lines 13, 15 and 23. Holding the player chip for 2 s still opens Demo tools directly. "Shops" on the Home card, "Fake loop: small", "Back to map", "Add test player", "Switch player" and "End the week" are unchanged.
- **LEAD, package.json:** the Invite QR uses `toqr` (tiny pure-JS QR encoder, no native code). It's already in node_modules as a dependency of `@expo/cli` but not declared. Please `npm i toqr@0.1.1` so a clean install keeps it. No new build is needed for the Revyl device.
- Home: "Menu" button (lucide Menu icon + the word "Menu") top right, always shown. The chip shows "12 blocks · 340 pts" from `wallet.mine`.
- `MenuPanel` slides in from the right over the scrim with Home (closes), Wallet, Exchange, Rewards, Shops, Ranking, Analytics, Invite, About, Demo tools. Navigation waits for the panel to dismiss (iOS drops a modal presented while another is closing).
- Wallet: balance as a `hero` StatNumber, vouchers (`VoucherCard`: code in hero, shop, "Use" with the same radius/Demo redeem rule, "Used." in green, too_far / already_used sentences), history (+12 green, -300 red, time ago), "Exchange points" primary at the bottom.
- Exchange: `offers.list` grouped by shop with distance, each offer a Card with title, shop, "300 pts" in lime, "Exchange" (disabled + "You need 120 more points" when short). Success: toast "Voucher added to your wallet" and opens Wallet.
- Rewards: "YOUR REWARDS" (the season prizes, same `RewardCard` as Shops, now in `src/components/RewardCard.tsx`) plus unused vouchers.
- Ranking: "Blocks" / "Points" tabs (`leaderboard.top` / `leaderboard.points`), my row highlighted with a lime border and "(you)".
- Analytics: points, blocks held, walks, distance tiles; 7-day bar chart of metres walked (react-native-svg, from `recent`, today in lime); steals made / suffered; last walks list.
- Invite: "Invite your neighbours", QR of the website link, "Open website", "Share invite" primary (RN Share).
- About: five rule lines, "Built at the YC Consumer Mobile Hackathon with Convex, Capy, Revyl and Whop", "Open website", the link and the version.
- Demo tools: new "Points" section with "Add 500 points" (`admin.grantPoints`, toast with the new balance).
- Result: "+N points" in lime under the block count when `pointsEarned` > 0.
- Checked: root `npx tsc --noEmit` exit 0; iOS export builds (3.4 MB). Nothing cut: chart and QR are both in. Not run on a device.
- Human check: Menu opens from the right; each row opens its screen; Demo tools > "Add 500 points", then Exchange an offer, then Wallet shows the voucher; Use it with Demo redeem on shows "Used.".

## HACK-BACKEND: B9: admin.demoSeed (done, NOT run live)
- `admin.demoSeed` (mutation, no args) returns `{ players, cells }`: `players` = demo players created by this call, `cells` = cells on the map afterwards.
- Reuses the real capture: I moved the body of `walks.submit` into `convex/lib/capture.ts` `captureWalk(ctx, player, points, now)`. `walks.submit` now just loads the player and calls it, so behaviour is unchanged and all old tests pass. demoSeed calls the same function with a `squareLoop` around each shop. It never writes cells by hand.
- Seeds the venue shops from `assets/seed-shops.json` if missing (by name; offers created too). Needed `"resolveJsonModule": true` in `convex/tsconfig.json`. seedShops now shares the same `upsertShops` helper.
- Players: Sam `demo#Sam` #FF4D5E "first to the boba" (Happy Cow, 130 m), Maya `demo#Maya` #9B5CFF "my block now" (Neighbor Bakehouse, 150 m), Leo `demo#Leo` #FF8A3D "run faster" (Piccino, 130 m). Colours are from playerColors, skipping #3D7BFF (first in the picker). Each gets +400 "Demo points" on top of the walk's own points.
- Idempotent: an existing demo player (by deviceId) is skipped; a second run returns `{ players: 0, cells: <same> }`.
- Result on a fresh DB (from the test): 24 cells. Sam holds Happy Cow at strength 7 (needs 8 to steal, so a 200 m loop takes it live; the test checks that). Maya holds Neighbor Bakehouse at strength 11, and Leo holds Piccino at strength 7. Humphry is free. Points: Maya 569, Sam 521, Leo 521.
- Note: Happy Cow and Neighbor Bakehouse are about 118 m apart, so Maya's 150 m loop overlaps Sam's by one block. Maya steals 1 block from Sam and one steal event appears in the feed (Sam keeps 6 blocks and the shop). This is the real rules at work; say if you would rather have no event and I will swap the order (Sam would then be blocked on that block instead).
- Tests: new `convex/demo.test.ts` (holders, offers, 400 points, flag on blocks, idempotent, live 200 m steal of Happy Cow). tsc is clean and vitest passes 39/39.
- Files to commit: convex/lib/capture.ts (new), convex/walks.ts, convex/admin.ts, convex/tsconfig.json, convex/demo.test.ts (new), hackathon.md.

## HACK-BACKEND: hackathon.md: Capy threads 3 + 4, Revyl v2, menu
- Capy: thread 3 `jam_01M7GRFV7Q85SACWSPRA01YMAG` (public website plus a GitHub Pages workflow, PR #3, with the site URL from the spec); thread 4 `jam_01M7GRX254RC2RDSPT62PZXRPA` (playable web version at `/app/`, react-leaflet map). No times given for these, so none were added.
- Revyl: the 3 tests now go through Menu, pushed to Revyl as v2 (after `244b564`).
- Timeline: 15:34 F10 (`244b564`) menu panel making the points economy playable end to end; plus the Capy threads 3 and 4 line. The points economy was already in the Convex section and at 15:28.
- No email address in the file (checked). File to commit: hackathon.md. On call for fixes until 4:30.

## HACK-BACKEND: B10: leaderboards return up to 50 rows (done)
- `leaderboard.top` and `leaderboard.points` now return at most 50 rows, with the same shapes. The limit is `LEADERBOARD_LIMIT = 50` in `convex/lib/config.ts`.
- New `convex/leaderboard.test.ts`: one test each (55 players, so exactly 50 rows come back, ordered most first, with the right first and 50th rows). tsc is clean and vitest passes 41/41.
- Files to commit: convex/lib/config.ts, convex/leaderboard.ts, convex/leaderboard.test.ts.

## F11: Store page, Profile, Settings, full Ranking, Analytics ranks (HACK-FRONTEND, 16:11)
- Store page `src/app/store.tsx?shopId=`: reward, distance, holder line, "Enclose N to take it" (or "You hold it with a 7-block loop."), then "Offers" for that shop with "300 pts" and "Exchange" (shared `OfferCard`: same rules and messages as Exchange, "You need N more points" when short, success toast + Wallet). Opened from a shop pin tap on Home (`ShopPin` now takes `onPress` on the Marker), a shop card tap in Shops, and the shop header ("<shop> · 300 m · View") in Exchange.
- Profile (Menu row 2): dot, name, flag, "Edit profile" (Nickname, colour swatches, "Your flag", "Save" / "Cancel") via `players.join` with the same id, plus `players.setFlag` when the flag changed; stats tiles (points, blocks held, walks, distance); "#4 of 12 by points" / "#2 of 9 by blocks" or "By points: Not ranked yet". The active player now remembers the id it joined with, so editing a demo test player edits that player and not the device's own.
- Settings (Menu row before About): "Distance units" Metres / Miles (AsyncStorage; every distance on screen follows: "500 ft" under 0.1 mi, else "0.4 mi"), "Haptics" (all haptics go through `src/lib/haptics.ts`, silenced when off), "Reduce motion" (combined with the system setting everywhere, including Skeleton), "Location permission" status + "Open settings", "Sign out on this device" with confirm "Sign out" / "Cancel" (clears the stored player only, back to Join), "About Lasso".
- Ranking: every row returned (up to 50) numbered with competition ranking (ties share the lower number), "Points" tab first, my row highlighted, pinned "YOUR RANK" glass card "#4 of 12 by points" or "Not ranked yet".
- Analytics: "Rank by points" and "Rank by blocks" StatNumbers.
- Menu: 12 rows now, scrollable on small phones.
- Web: no new native modules (Switch, Share, Modal, expo-location are all fine on web); `Linking.openSettings()` calls now catch, since browsers do not implement it.
- Checked: `npx tsc --noEmit` clean for every file I own; iOS export builds (3.4 MB). Nothing cut. Not run on a device.
- **LEAD:** root tsc currently fails only in Capy's `src/components/LassoMap.web.tsx` and `maps.web.tsx`: `leaflet` / `react-leaflet` / `@types/react-dom` aren't installed in this checkout. Run `npm install` after the web PR (and add `@types/react-dom` + `@types/leaflet` as dev deps if they're missing from package.json).

## HACK-BACKEND: hackathon.md: 15:37-16:45 entries
- Timeline: 15:37 PR #3 (`b65db72`), 15:55 PR #4 (`23ecdb4`), 16:03 contract v5, 16:04 B10 (`b7c130c`), 16:27 F11, 16:45 freeze. The Capy section now has the PR #3 and #4 merge hashes. No email in the file. File to commit: hackathon.md.
- Known open items: (1) the Whop invoice cannot be issued until the owner verifies the Whop sandbox business; (2) the test player "Backend Test" (deviceId `backend-live-test`) is still on the live deployment, because reset keeps players, so it will appear in leaderboard.points with 0 points; (3) demoSeed has not been run live yet (the Lead runs reset + demoSeed after the freeze).

## F11 fix: Menu navigation fallback (HACK-FRONTEND, 16:27)
- `MenuPanel` opened the next screen only from the iOS Modal `onDismiss` event. If that event ever fails to fire, "Menu" > "Demo tools" would do nothing and every revyl/*.yaml test would stall. It now also navigates from a 600 ms fallback timer; whichever runs first clears the pending route, so it never navigates twice.
- Checked revyl/*.yaml against the current labels: all steps match (Nickname, colour circles, Start, Start walk, Menu, Demo tools, Fake loop: small/large, Around: Happy Cow Creamery & Tea, Seed venue shops, End the week, Demo redeem, Shops, YOUR REWARDS, Redeem, Redeemed., Add test player, Acting as, Switch player, Back to map, You claimed, BLOCKS CLAIMED, were taken from other players, Sam took). No label changes since F10.
- root `npx tsc --noEmit` exit 0; iOS export builds.

## F13: more content in Wallet, Rewards, Analytics, Invite; F14 rule line (HACK-FRONTEND, 17:13)
- `src/app/wallet.tsx`: "Next voucher" card: progress bar of your balance toward the cheapest offer you can't afford yet, "120 pts to a Free croissant", "at <shop>. Every 10 m walked is 1 point, every block 10."; "You can afford every offer on the map." / "Offers appear when shops join the map." when there is none. "Offers you can afford": up to 3 `OfferCard`s (most expensive first), or "Nothing yet. A 500 m loop earns about 50 points plus 10 per block."
- `src/app/rewards.tsx`: "UP FOR GRABS THIS WEEK": each shop's prize in gold, shop name, "Sam holds it now" / "You hold it now" / "Nobody holds it yet" with the holder's dot, "Enclose N to take it"; tapping opens the Store page.
- `src/app/analytics.tsx`: new tiles from `stats.recent` / `totalM`: "Days in a row" (streak of days with a walk, ending today or yesterday), "Longest loop, blocks", "Best day" (metres, follows the units setting), "Blocks claimed", "~N About kcal burned" (0.05 kcal per metre). Minutes walked / pace skipped: walks have no duration in the data. Note: `recent` is the newest 30 walks, so streak, best day and blocks claimed cover those 30.
- `src/app/invite.tsx`: "Invite by email": Email field + "Send invite" (disabled until it looks like an email) opens `mailto:` with subject "Join me on Lasso" and a body with the website link; "No email app is set up on this device." toast if it can't open.
- F14 (partial): About's rule list gains "Blocks fade: they lose 1 strength every hour unless you walk them again." `cells.all` has no `fadesAt` yet, so there is no "Fades in 23 min" line. Tell me when B12 adds it and I'll add it to the target card and the tap-a-block card.
- No revyl label changed. root `npx tsc --noEmit` exit 0; iOS export builds (3.4 MB).
- Note: while writing the Wallet change, a shell quoting slip briefly put the output of Windows' `at` command (a deprecation/usage message, nothing scheduled) into wallet.tsx; I replaced those lines before type-checking. The file is clean.

## HACK-BACKEND: B12: block decay (done, deployed, 17:14)
- Rule: effective = stored - floor((now - claimedAt) / DECAY_EVERY_MS), never below 0. At 0 the block is free. Config in `convex/lib/config.ts`: `DECAY_ENABLED = true`, `DECAY_EVERY_MS = 1 hour`. No scheduler and no schema change: `cells.claimedAt` already exists.
- Capture (`lib/rules.ts` planCapture, used by walks.submit and demoSeed):
  - Steal checks n > effective.
  - A decayed block (effective 0) is claimed, not stolen, so there is no steal event. If it is a shop block, the old holder is credited hold time up to the moment it decayed.
  - Own live block = refresh: strength = max(effective, n), and `claimedAt = now` restarts the clock (written in `lib/capture.ts`). Shop hold time so far is banked first, so refreshing never loses season time.
- Reads use effective strength and treat 0 as unowned:
  - `cells.all` skips decayed blocks, returns effective `strength`, and adds `fadesAt` (ms when the strength next drops by 1).
  - `shops.list` has no holder when decayed; strength and needed are effective.
  - `leaderboard.top` and `stats.mine.blocksHeld` count only live blocks.
  - `season.end` (seasonWinners) ends the holder's stretch at decay.
  - Events keep the strength from the moment of the steal (history).
- Note: Convex queries re-run when data changes, not as time passes, so a screen shows the decay the next time anything changes. `fadesAt` lets the app count down on its own.
- Tests: new `convex/decay.test.ts` (4 tests: the formula and nextDropAt; decay to free (off the map, no shop holder, off the leaderboard, re-claim without an event); a smaller loop steals once the defender has decayed; an own loop refreshes and restarts the clock). I changed 2 kit tests in `lib/loop.test.ts` to the new rule (the blocked test now uses a fresh block; the own-cells test now expects refresh) and fixed my leaderboard test data (claimedAt now). tsc is clean and vitest passes 45/45.
- Live check: `cells:all` returns `fadesAt`. The 7 blocks from the 17:13 Revyl capture test show strength 7.
- Files to commit: convex/lib/config.ts, convex/lib/loop.ts, convex/lib/rules.ts, convex/lib/capture.ts, convex/cells.ts, convex/shops.ts, convex/leaderboard.ts, convex/stats.ts, convex/decay.test.ts (new), convex/lib/loop.test.ts, convex/leaderboard.test.ts, hackathon.md.

## F14: block fade countdown (HACK-FRONTEND, 17:16)
- `src/lib/format.ts`: `fadesText(fadesAt, now)`: "Fades in 23 min" / "Fades in 1 h 5 min" / "Fades in under a minute", "Fading now. Walk it again to keep it." once past, nothing when `fadesAt` is null (decay off).
- `src/app/home.tsx`: target card when I hold the nearest shop shows the shop cell's fade line in gold under "Held for…"; the tap-a-block card shows the block's fade line (gold for my block, muted for others). Counts down client-side on Home's existing 30 s tick.
- `src/app/about.tsx` already has "Blocks fade: they lose 1 strength every hour unless you walk them again." (F13).
- No revyl label changed. root `npx tsc --noEmit` exit 0; iOS export builds. Frontend frozen from here.

## HACK-BACKEND: demo map ready (17:16)
- Deleted 14 test players with admin:deletePlayer: the 13 listed plus the "Ana" from the 17:13 Revyl capture run. Kept the owner's device d_1b174c... It is now named "Jack" (renamed in Profile; flag "Hi there"), and has 0 points.
- admin:reset, then admin:demoSeed: { cells: 24, players: 3 }.
- Holders: Happy Cow = Sam (strength 7, needs 8); Neighbor Bakehouse = Maya (11, needs 12); Piccino = Leo (7, needs 8); Humphry Slocombe is free (needs 6).
- Points: Maya 569, Sam 521, Leo 521, Jack 0. 1 steal event in the feed (Maya took 1 block from Sam). 8 offers.
- Decay: these blocks were claimed at 17:16, so they start losing 1 strength per hour from 18:16 (Sam's Happy Cow drops to 6 at 18:16).
- Freeze: on call for fixes only.

## F15: Analytics shows numbers everywhere (HACK-FRONTEND, 17:34)
- File: `src/app/analytics.tsx` only.
- 7-day chart: header "2.4 km this week · 340 m a day" (follows the units setting); the value above every bar ("420 m", "0" on empty days); single weekday letters under the bars; section title now "Distance walked, last 7 days".
- Steals: a third number "Net" (+2 in green, -1 in red, 0 in white) beside Made / Suffered.
- Last walks: each row "520 m · 7 blocks · +122 pts" + time ago + status. Points per walk are computed on the client with the contract v4 formula (floor(m / 10) + 10 per block, 0 when rejected), because `stats.mine.recent` carries no points. Empty state: "0 walks · 0 m · 0 blocks" with a small hint line.
- Ranks: "#4 of 12", or "#– of 12" when not ranked (player count from the leaderboard).
- Every tile shows a number (0 when empty). The rank tiles show "…" only while loading.
- No revyl label changed. root `npx tsc --noEmit` exit 0; iOS export builds.
