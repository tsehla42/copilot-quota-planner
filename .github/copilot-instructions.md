# GitHub Copilot Quota Calculator — AI Assistant Instructions

## Purpose

Enable AI agents to understand, maintain, and enhance a standalone SPA calculator for GitHub Copilot Business quota tracking with live GitHub API integration.

## Project Overview

**GitHub Copilot Quota Planner** — an interactive calculator for tracking GitHub Copilot Business quota usage. Runs entirely in the browser with no server required at runtime. Built from modular source with Vite.

- **Type**: Single-page app distributed as one self-contained `index.html` file
- **Source**: Modular ES2020+ JavaScript under `src/js/`, styles in `src/style.css`, HTML template in `src/index.html`
- **Build**: Vite + vite-plugin-singlefile — inlines all CSS + JS into `_build/index.html`, then `postbuild` copies it to `index.html`
- **Tech Stack**: Zero runtime dependencies — vanilla HTML5, CSS3, pure JavaScript (ES2020+)
- **Runtime**: Browser only. Open `index.html` (the build output) directly — no server required.

## Key Files

| File | Type | Purpose |
|------|------|---------|
| [index.html](index.html) | Distributable | Build output — single self-contained file for end users |
| [src/index.html](src/index.html) | Template | HTML structure (no inline CSS/JS) |
| [src/style.css](src/style.css) | Styles | All CSS |
| [src/js/main.js](src/js/main.js) | Entry point | App init, event wiring, `fetchRealUsage()` |
| [src/js/accounts.js](src/js/accounts.js) | Multi-account | Account CRUD, card stack UI, header collapse, `ghHeaders()` |
| [src/js/auth.js](src/js/auth.js) | Auth utilities | `escHtml()`, `GH_API`, `GITHUB_ICON`, legacy token helpers |
| [src/js/budgetCalculator.js](src/js/budgetCalculator.js) | Pure math | `calculateBudget(p)` — no DOM, fully testable |
| [src/js/calendar.js](src/js/calendar.js) | Calendar UI | Day-off selection, weekend exclusion |
| [src/js/uiHelpers.js](src/js/uiHelpers.js) | DOM/display | `updateStatus()`, `syncUsage()`, `MODELS`, formatters |
| [src/js/state.js](src/js/state.js) | Shared state | `export const state = { quotaEntitlement, quotaRemaining }` |
| [src/tests/](src/tests/) | Tests | Vitest unit tests for each module |
| [.github/copilot-instructions.md](.github/copilot-instructions.md) | Docs | This file |

## Architecture & Data Flow

```
User Browser
    ↓ Manual usage % input  OR  click "Fetch" button
    ↓
Direct fetch to api.github.com (CORS: Access-Control-Allow-Origin: *)
    └─ GET /copilot_internal/user  (requires ghu_ OAuth token)
         Response: { quota_snapshots: { premium_interactions: { percent_remaining, entitlement, remaining, unlimited } }, quota_reset_date, copilot_plan }
    ↓ usage % = 100 - percent_remaining
    ↓
main.js → updateAccountQuota() → state.quotaEntitlement / state.quotaRemaining
    ↓
uiHelpers.updateStatus() → budgetCalculator.calculateBudget(p) → DOM updates
```

**Key Design Principle**: No server, no proxy, no env vars. All GitHub API calls are made directly from the browser.

## Token Requirements

| Token type | Prefix | Works for |
|------------|--------|-----------|
| OAuth (VS Code session) | `ghu_` | `/copilot_internal/user` — returns real quota % ✅ |
| Classic PAT | `ghp_` | `/user` only — no quota data ❌ |
| Fine-grained PAT | `github_pat_` | `/user` only — no quota data ❌ |

**To get a `ghu_` token from VS Code (recommended):**
1. `F1` → "Developer: Toggle Developer Tools" → Network tab
2. Filter by `copilot_internal`, tick Preserve log
3. Send any Copilot Chat message (`Ctrl+Alt+I`)
4. Click the `user` request → Request Headers → copy value after `Authorization: token `

## Development Workflow

### Dev Server
```
npm run dev     # Vite dev server at http://localhost:5173 (root: src/), HMR enabled
```

### Production Build
```
npm run build   # vite build → _build/index.html (singlefile, un-minified)
                # postbuild: cp _build/index.html index.html
```
Output `index.html` is the distributable — all CSS + JS inlined, fully readable vanilla JS.

### Tests
```
npm test                              # run all Vitest tests (watch mode)
npm test -- src/tests/foo.test.js    # run one test file
npm run test:ui                       # Vitest browser UI
```

### Auth Storage (localStorage)
| Key | Value |
|-----|-------|
| `gh_accounts` | JSON array of `{ id, token, login, name, avatar_url, plan, lastQuota }` account objects |
| `gh_selected_id` | String ID of the currently selected account |

Legacy keys `gh_token` / `gh_user` are migrated automatically by `migrateFromLegacy()` on first load.

### Account Object (`gh_accounts` array element)

| Field | Type | Purpose |
|-------|------|---------|
| `id` | string | Unique identifier (`acc-<timestamp>-<random>`) |
| `token` | string | GitHub token (`ghu_`, `ghp_`, `gho_`, `github_pat_`) |
| `login` | string | GitHub username |
| `name` | string | GitHub display name (may be empty) |
| `avatar_url` | string | Profile picture URL |
| `plan` | string\|null | Plan type from API (`free`, `pro`, `business`), or null |
| `lastQuota` | object\|null | Cached quota snapshot: `{ pctUsed, entitlement, remaining, resetDate, unlimited, timestamp }` |

## Important Patterns & Conventions

### Source vs. Distributable
- **Edit source files** in `src/` during development, run `npm run dev`
- **Never hand-edit** the generated `index.html` or `_build/index.html` — they are overwritten by builds
- **No framework**: DOM state via input values + direct `getElementById` manipulation
- **Modules**: ES2020 `import`/`export`. `main.js` assigns needed functions to `window` for inline HTML handlers

### CSS & Styling
- **Custom number spinners**: `.num-wrap` / `.num-spin` CSS classes around `<input type="number">` with custom ▲▼ buttons driven by `stepNum(id, delta, min, max)`
- **Status indicators**: Green (under budget) → Yellow (slightly over) → Red (over budget)
- **Modal pattern**: Single `#authModal` overlay; content swapped via `#modalContent` innerHTML; `#accountsModal` for add/remove accounts
- **Toggle switch**: `.toggle-switch` / `.toggle-track` / `.toggle-knob` CSS — `#reqModeChk` checkbox toggles `%` vs request-count display (off by default)
- **No inline styles**: use utility CSS classes (`.fw-600`, `.fs-11`, `.muted`, `.mb-*`, `.d-block`, etc.) or component classes; inline `style=` only for dynamic JS-driven values like colors

### Shared State (`state.js`)
```js
// src/js/state.js — imported by uiHelpers.js and main.js
export const state = {
  quotaEntitlement: 300,   // updated from API response (pi.entitlement)
  quotaRemaining:   null,  // null until fetched; set to pi.remaining on success
};
```

### Module-owned State
```js
// calendar.js owns:
export let calCustomDayoffs = new Set(); // ISO date strings marked as days off
export let calViewYear, calViewMonth;    // calendar popup navigation (0-based month)
```

## Key JS Functions

```js
// ── accounts.js — multi-account management ──────────────────────────────────
getAccounts()                // returns parsed gh_accounts array from localStorage
getSelectedAccount()         // returns full account object for gh_selected_id (or first)
getSelectedToken()           // shorthand: getSelectedAccount()?.token ?? null
addAccounts(tokenArray)      // validates tokens, calls GET /user, saves to gh_accounts
removeAccount(id)            // splices account by id, updates gh_selected_id
updateAccountQuota(id, quota, plan?) // updates account.lastQuota (and plan) in localStorage
migrateFromLegacy()          // migrates old gh_token/gh_user to gh_accounts on first load
signOutAll()                 // removes gh_accounts + gh_selected_id from localStorage
ghHeaders()                  // returns { Authorization, Accept } using selected account's token
renderAccountsHeader()       // re-renders #accountsStatic (only if count changed) + calls _updateCardSlots()
_updateCardSlots(animate?)   // populates persistent #cardSlot-{0..3} DOM nodes with selected + peek cards
navigateAccount(direction)   // cycle accounts left/right; triggers card animation
toggleHeader()               // collapse/expand #accountsHeader, persists to localStorage
initHeaderCollapsed()        // on page load: applies collapsed state instantly (no transition)
openAccountsModal()          // opens multi-token add/remove modal
closeAccountsModal()         // closes it
signOutAllAndRender()        // signOutAll() + re-renders header
removeAccountAndRender(id)   // removeAccount() + re-renders header
showToast(msg)               // shows temporary toast notification

// ── auth.js — shared utilities ──────────────────────────────────────────────
escHtml(s)                   // escapes &<>" for safe innerHTML; use for ALL user data
GH_API                       // 'https://api.github.com'
GITHUB_ICON                  // GitHub SVG icon string
_setFetchStatus(msg, color)  // updates #fetchStatus text

// ── budgetCalculator.js — pure math ─────────────────────────────────────────
calculateBudget(p)           // pure function; p: { usage, currentDay, totalDays, calViewYear,
                             //   calViewMonth, excludeWeekends, customDayoffs,
                             //   quotaEntitlement, quotaRemaining }
                             // returns: { remainingPct, calendarDaysLeft, workingDaysLeft,
                             //   workingDaysElapsed, idealDailyBudget, burnRate, projected,
                             //   perfectTarget, vsTarget, paceRatio, statusColor, paceText, ... }

// ── calendar.js ──────────────────────────────────────────────────────────────
openCalendar()               // shows calendar popup
closeCalendar()              // hides popup, syncs day-offs to UI
calNavMonth(delta)           // navigate month (±1) in popup
calToggleDay(iso)            // toggle ISO date string in calCustomDayoffs Set
clearCustomDayoffs()         // reset all custom day-offs, re-render
getExcludeWeekends()         // returns #excludeWeekendsChk checkbox state

// ── uiHelpers.js ─────────────────────────────────────────────────────────────
syncUsage(val)               // slider change: syncs slider ↔ input ↔ label, clears state.quotaRemaining
syncUsageFromInput(val)      // input change:  same, clears state.quotaRemaining before updateStatus()
updateStatus()               // main recalculate: calls calculateBudget, updates all stat DOM elements
                             // respects #reqModeChk toggle for % vs request-count display
renderAllMonths()            // populates #allMonthsBody from MODELS (all 4 tiers incl. Grok)
updateRequestsToday(idealDay) // populates #requestsToday — MODELS filtered by showInToday: true
stepNum(id, delta, min, max) // increment/decrement number inputs, dispatches 'input' event
fmt1(n) / fmt2(n) / fmtInt(n) // formatters: 1dp, 2dp, integer with thousands separator

// ── main.js — orchestration ──────────────────────────────────────────────────
fetchRealUsage()             // GET /copilot_internal/user → sets state.quotaEntitlement/quotaRemaining
                             // on 404/403 falls back to GET /user (validity check only)
                             // on success: calls updateAccountQuota() to cache in localStorage
onMonthLenChange()           // called when month-length input changes
```

### MODELS Array (in `uiHelpers.js`)
All model tiers; `showInToday` controls visibility in the daily-budget card:
```js
{ mult, costPct, label, color, examples[], showInToday }
// 0.25× — Grok Code Fast 1                              showInToday: false (table only)
// 0.3×  — Claude Haiku 4.5, Gemini Flash 3.1, GPT-5.2 Mini  showInToday: true
// 1×    — Claude Sonnet 4.5/4.6, GPT-5.2, Gemini 2.5 Pro    showInToday: true
// 3×    — Claude Opus 4.6, GPT-5.1 (older)              showInToday: true
```

### Perfect Pace Target
`perfectTarget = 100 * currentDay / totalDays`

This is a simple **calendar-days** uniform-burn benchmark. It does **not** account for weekends or day-offs — it intentionally matches the original app behavior.

### Card Stack UI (in `accounts.js`)
- **Persistent DOM**: 4 fixed slots `#cardSlot-0` through `#cardSlot-3` always exist; content is swapped, not recreated
- **Viewport-aware peeks**: `_computeMaxPeeks(count)` calculates how many peek cards fit based on `(viewportWidth - 280 - 40) / 60`; max 3 peeks
- **Slot order** (back → front): slot-0 is the furthest-back peek; the selected card is the frontmost slot (index = maxPeeks)
- **Animation reflow pattern**: When adding `.entering`/`.exiting` classes, always `void slot.offsetWidth` between removing and re-adding to force a CSS reflow — otherwise the browser batches the mutations and no animation plays
- **Static zone guard**: `renderAccountsHeader()` only rebuilds `#accountsStatic` (label + buttons) when account count changes, preventing flash on every switch

### Collapsible Header
- `#headerToggleBtn` inside `#accountsHeader` at `position: absolute; top: 8px; right: 12px`
- On collapse: adds `.collapsed` to header (max-height → 0), adds `.floating` to button (fixed position top-right)
- State persisted to `localStorage.headerCollapsed`
- On load: `initHeaderCollapsed()` applies state with `.no-transition` to skip animation

## GitHub API Integration

### Endpoint Used
- `GET https://api.github.com/copilot_internal/user`
  - Requires `X-GitHub-Api-Version: 2025-04-01` header
  - Requires `ghu_` OAuth token with `github.copilot` scope
  - Returns: `{ quota_snapshots: { premium_interactions: { percent_remaining, entitlement, remaining, unlimited }, chat: {...}, completions: {...} }, quota_reset_date, copilot_plan }`
  - **This is the exact endpoint VS Code's Copilot extension uses for its status bar quota display**

### Fallback for ghp_ tokens
- On 404/403 from `copilot_internal/user` → falls back to `GET /user` (token validity check only)
- Sets informational status message directing user to get a `ghu_` token

## Common Pitfalls & Solutions

| Pitfall | Solution |
|---------|----------|
| Fetch returns 404 on `copilot_internal/user` | Token is a `ghp_` PAT — needs OAuth `ghu_` token |
| Token works but quota % not shown | Same — only `ghu_` tokens have the `github.copilot` scope |
| Req-mode toggle shows wrong counts | `state.quotaRemaining`/`state.quotaEntitlement` come from API; moving slider clears `state.quotaRemaining`, falling back to %-derived counts |
| Calculations incorrect | Check that usage % and day inputs are valid numbers (1–31 for day) |
| Day shows yesterday | Page was loaded on the previous day — refresh |
| Card stack overlap with 2 accounts | Caused by `left` position formula bug — `_computeMaxPeeks` returns 1; selected is at `left: 1 * PEEK_OFFSET = 60px`, peek at `left: 0` |
| Card animations don't play | Missing `void slot.offsetWidth` reflow between removing and adding CSS animation classes |
| Header blinks on account switch | `renderAccountsHeader()` is rebuilding `#accountsStatic` on every call — apply the `count !== _lastRenderedCount` guard |
| Editing `index.html` directly | Don't — it's a build artifact. Edit `src/` files and rebuild |
| XSS via user data | All user-supplied strings rendered via `escHtml()` from `auth.js` before innerHTML injection |


## Clarifying Questions — VS Code Chat Override

> **User instruction — takes highest priority over all superpowers skills** (per Instruction Priority in `using-superpowers`).

This project runs in **VS Code Copilot Chat**. The brainstorming skill says "only one question per message" — **that rule does NOT apply here**.

**ALWAYS batch ALL clarifying questions into a single `vscode_askQuestions` tool call.** Never ask a question in plain text and wait for a reply.

You may call `vscode_askQuestions` multiple times in one task if new questions arise — that's fine and expected.

---

## Never "Breaking Questions"
❌ Do NOT:
- Stop mid-task and ask a question as plain text, then wait for a new message
- Wait for a fresh prompt to continue reasoning
- Let the brainstorming skill's "one question per message" rule cause request interruptions

This consumes extra requests and breaks the agent's thought process.
