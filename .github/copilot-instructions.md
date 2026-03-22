# GitHub Copilot Quota Calculator — AI Assistant Instructions

## Purpose

Enable AI agents to understand, maintain, and enhance a standalone SPA calculator for GitHub Copilot Business quota tracking with live GitHub API integration.

## Project Overview

**GitHub Copilot Quota Planner** — an interactive calculator for tracking GitHub Copilot Business quota usage. Runs entirely in the browser with no server, no build step, and no dependencies.

- **Type**: Fully standalone single-page app (one `index.html` file)
- **Architecture**: All logic (UI, calculations, GitHub API calls) lives in `index.html`
- **Tech Stack**: Zero dependencies — vanilla HTML5, CSS3, pure JavaScript (ES2020+)
- **Runtime**: Browser only. Open `index.html` directly — no server required.

## Key Files

| File | Type | Purpose |
|------|------|---------|
| [index.html](index.html) | Everything | Layout, styles, calculation logic, UI state, GitHub API fetch |
| [.github/copilot-instructions.md](.github/copilot-instructions.md) | Docs | This file — agent context and conventions |

## Architecture & Data Flow

```
User Browser (index.html)
    ↓ Manual usage % input  OR  click "Fetch" button
    ↓
Direct fetch to api.github.com (CORS: Access-Control-Allow-Origin: *)
    └─ GET /copilot_internal/user  (requires ghu_ OAuth token)
         Response: { quota_snapshots: { premium_interactions: { percent_remaining, ... } }, quota_reset_date, copilot_plan }
    ↓ usage % = 100 - percent_remaining
    ↓
Frontend updates slider + calculates burn rate / projection / daily budget
```

**Key Design Principle**: No server, no proxy, no env vars. All GitHub API calls are made directly from the browser. `api.github.com` returns permissive CORS headers.

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

**Alternative:** `secret-tool search application vscode` (Linux) or `gh auth token` (after `gh auth login`)

## Development Workflow

### Running Locally
Just open `index.html` in a browser — no server, no install, no build.

```bash
# Fast open in default browser (Linux):
xdg-open index.html
```

### Auth Storage (localStorage)
| Key | Value |
|-----|-------|
| `gh_token` | The `ghu_` or `ghp_` token |
| `gh_user` | `{ login, name, avatar_url }` JSON |

## Important Patterns & Conventions

### Frontend (Vanilla HTML/JS in index.html)
- **Everything in one file**: styles in `<style>`, logic in `<script>` at bottom of `<body>`
- **No framework**: DOM state via input values + direct `getElementById` manipulation
- **Custom number spinners**: `.num-wrap` / `.num-spin` CSS classes wrap `<input type="number">` with custom ▲▼ buttons driven by `stepNum(id, delta, min, max)`
- **Status indicators**: Green (under budget) → Yellow (slightly over) → Red (over budget)
- **Modal pattern**: Single `#authModal` overlay; content swapped via `#modalContent` innerHTML

### Key JS Functions

```js
// Auth
getToken()            // reads from localStorage
ghHeaders()           // returns Authorization + Accept headers
renderAuthCard()      // renders connected/disconnected states in #authCard
openAuthModal()       // opens PAT input modal
_savePAT()            // validates format, calls _verifyAndSave(token)
_verifyAndSave(token) // GET /user to confirm valid, stores in localStorage
signOut()             // clears gh_token, gh_user from localStorage

// Core fetch
fetchRealUsage()      // tries copilot_internal/user → falls back to /user for ghp_ tokens
autoFetchOnLoad()     // silent fetch on page load if token is saved

// UI helpers
stepNum(id, delta, min, max) // increment/decrement number inputs, dispatches 'input' event
syncUsage(val)        // syncs slider ↔ number input ↔ display label
updateStatus()        // main calculator: burn rate, projection, pace indicator

// Tables
renderAllMonths()     // populates #allMonthsBody: req/day per model × 4 month lengths
```

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
| Calculations incorrect | Check that usage % and day inputs are valid numbers (1–31 for day) |
| Day shows yesterday | Page was loaded on the previous day — refresh |
| XSS via user data | All user-supplied strings rendered via `escHtml()` before innerHTML injection |
