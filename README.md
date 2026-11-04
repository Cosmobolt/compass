# Compass

A personal assistant web app for study, prayer and daily life. It installs to your phone's home screen and works like an app.

## What's in this first version

- **Today**: your one thing for the day, today's schedule, what's due this week, the liturgical day (season, feasts, Mass obligations, Friday penance) and your prayer checklist.
- **Deadlines**: add coursework, break it into small steps (by hand or with AI), pick up due dates found in your Brightspace calendar, and deal with anything overdue.
- **Calendar**: the next 14 days from your connected calendars (Outlook, Brightspace, Google) plus classes you add by hand.
- **Check-in**: a 2-minute evening examen. Mark which classes you went to (missed ones go on a catch-up list), tick off prayers, and set tomorrow's one thing.
- **Setup**: connect calendars, add weekly classes, edit your prayer practices, back up your data.

Data is stored on your device (browser storage). Use Setup, then Download backup, to keep a copy.

## Run it locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Put it online (free, about 10 minutes)

1. Push this folder to a GitHub repository.
2. Go to https://vercel.com, sign in with GitHub, and choose **Add New Project**. Pick the repository and press **Deploy**. Vercel detects Next.js automatically.
3. Optional, for "Suggest steps with AI": in the Vercel project go to **Settings, Environment Variables**, add `ANTHROPIC_API_KEY` with a key from https://console.anthropic.com, and redeploy. Without it, everything else still works.
4. Open the site on your phone.
   - **iPhone**: Safari, Share button, **Add to Home Screen**.
   - **Android**: Chrome menu, **Install app** (or Add to Home screen).

Keep your site's link to yourself, since the AI button uses your API key.

## Tech

Next.js 16 (App Router) as a PWA, `ical.js` for calendar feeds (fetched server-side at `/api/calendar`, which only allows public addresses), and the Claude API (`/api/breakdown`) for step suggestions.

## Next ideas

- Push notifications: morning brief and "class in 20 minutes" reminders.
- Sign-in and sync between phone and laptop (Supabase).
- Physical pillar: sleep, meals, exercise, and habits or vices to track.
- Intellectual pillar: reading list and daily reading time.
- Weekly review on Sundays that rebuilds your catch-up plan.
