# GitHub Copilot Quota Planner

This project was enterily vibecoded with that same Copilot, and awesome 
[superpowers](https://github.com/obra/superpowers)

Without Copilot it wouldn't be possible and to be honest wouldn't make any sense.

But that a philosophycal question.

The project deliberately uses plain JavaScript and the production `index.html` file is not minified. This is intentional for transparency. You can review the generated file yourself or drop it into your agent to look for potential vulnerabilities.

Below is a generated description of what it does and how to use it.

---

An interactive calculator for tracking your [GitHub Copilot](https://github.com/features/copilot) premium request quota. See how fast you're burning through your monthly budget, project how much you'll use by end of month, and figure out how many AI requests you can make each day.

No server. No install. Just open `index.html` in your browser.

---

## What It Does

GitHub Copilot Business plans include a monthly allotment of **premium interactions** (chat, inline completions with powerful models). This tool helps you:

- **Track your burn rate** — are you using quota faster or slower than expected?
- **Project end-of-month usage** — will you run out before the reset?
- **Budget daily requests** — how many interactions can you make today without going over?
- **See per-model limits** — how many Claude Sonnet, Opus, Haiku, or Gemini requests fit in your daily budget?

---

## Quick Start

1. Open `index.html` directly in your browser (no server needed)
2. Enter your current usage % (find it at [github.com/settings/copilot](https://github.com/settings/copilot))
3. Set today's day of month and the month length
4. Read your burn rate, projection, and daily budget

That's it — all calculations happen instantly in the browser.

---

## Live Quota Fetch (Optional)

If you connect a GitHub token, the calculator will fetch your real quota percentage automatically instead of you having to look it up manually.

> **Important:** Only a `gho_` OAuth token works for this. Regular Personal Access Tokens (`ghp_`, `github_pat_`) cannot access the quota API.

### How to get a `gho_` token from VS Code

1. Press `F1` → "Developer: Toggle Developer Tools" → open the **Network** tab
2. Press `Ctrl+R` to reload the page
3. Find the `user` request
4. Click that row → **Request Headers** → copy the value after `Authorization: token `
5. Paste it into the "Connect token" form in the calculator

The token is stored only in your browser's `localStorage` and sent directly to `api.github.com` — never to any third party.

You can connect multiple accounts and switch between them to track quota across different GitHub organizations.

---

## Reading the Dashboard

| Metric | What it means |
|--------|---------------|
| **Usage %** | How much of your monthly quota is gone |
| **Burn rate** | % per calendar day at your current pace |
| **Projected** | Estimated total usage by end of month |
| **Ideal daily budget** | % you can spend today to finish exactly at 100% |
| **vs. Perfect pace** | Are you ahead or behind a uniform burn target? |
| **Daily requests** | Concrete request counts per model tier |

**Status colors:** Green = on track, Yellow = slightly over pace, Red = significantly over pace.

---

## Day-Off Support

Click the calendar icon to mark days you won't be using Copilot (holidays, PTO, weekends). The daily budget calculation adjusts to spread remaining quota across only your working days.

---

## Development

This project uses [Vite](https://vitejs.dev/) to build from modular source files into the single distributable `index.html`.

```sh
npm install
npm run dev      # dev server at http://localhost:5173
npm run build    # builds index.html
npm test         # run unit tests
```

For technical details on the architecture, modules, and API integration, see [.github/copilot-instructions.md](.github/copilot-instructions.md).

---

## License

[GNU General Public License v3.0](LICENSE)
