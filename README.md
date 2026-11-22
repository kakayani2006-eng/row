# Personal Dashboard

A set of small, self-contained HTML apps that share a top bar.

## Deploy your own copy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FRowanThistlebrooke%2FYTdashh1)

One click → Vercel signs you in, copies the repo to your GitHub, and deploys it. ~30 seconds to a live URL.

## How to use

Open any `.html` file directly in your browser — no build step, no install.

| File | What it is |
|---|---|
| [index.html](index.html) | Goals tracker (Day Ring, Goal Ticker, To Do list) — the home page |
| [health.html](health.html) | Supplement / daily stack tracker |
| [finance.html](finance.html) | Finances |
| [gym.html](gym.html) | Progressive overload gym tracker |
| [uni.html](uni.html) | Uni — this week, deadlines, and a revision tracker by module and lecture |
| [topbar.js](topbar.js) | Shared top bar — auto-injected into pages that `<script src="topbar.js">` |
| [sandbox.js](sandbox.js) | Sandbox mode — add `?sandbox` to any page URL for a copy with sample data and cloud sync off |

Each app stores its own state in browser `localStorage`. No accounts, no server.

## Building from scratch

[BUILD_DASHBOARD.md](BUILD_DASHBOARD.md) is the prompt I gave Claude to generate `index.html` — paste it into Claude if you want to rebuild that page yourself.

## Steps from the iPhone Health app

The Fitness page has a Steps card. A website cannot read Apple Health, so an
iPhone Shortcut sends each day's step count to the Supabase `app_state` table
as a row keyed `steps:YYYY-MM-DD` with data `{"steps": 8421}`. Running it
again on the same day overwrites that day's number.

Build the shortcut in the Shortcuts app with these actions, in order:

1. **Find Health Samples** — Type is *Steps*, Start Date is *today*.
2. **Calculate Statistics** — *Sum* of *Health Samples*.
3. **Round Number** — round the result to *Ones Place*.
4. **Format Date** — *Current Date*, Custom format `yyyy-MM-dd`.
5. **Format Date** — *Current Date*, format *ISO 8601*, include time.
6. **Text** — type this, inserting the variables from steps 4, 3 and 5:
   `{"key":"steps:[Formatted Date]","data":{"steps":[Rounded Number]},"updated_at":"[ISO Date]"}`
7. **Get Contents of URL**
   - URL: `https://YOUR-PROJECT.supabase.co/rest/v1/app_state?on_conflict=key`
   - Method: POST
   - Headers: `apikey` = your publishable key, `Authorization` = `Bearer ` + the
     same key, `Content-Type` = `application/json`,
     `Prefer` = `resolution=merge-duplicates`
   - Request Body: *File*, set to the Text from step 6

Then in Shortcuts > Automation, add a *Time of Day* automation that runs it
daily (set it to run immediately). Health data is locked while the phone is
locked, so pick a time the phone is normally in use.
