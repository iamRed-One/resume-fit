# Contributing to Resume Fit

Thanks for helping. This project is small on purpose, so a short read will get you productive.

## The one rule

**Nothing may weaken the check that stops invented facts.** Resume Fit exists so that people can tailor a resume without the tailoring lying for them. A change that makes the score look better, or the output look more impressive, by letting a made-up number, employer or tool through will not be merged. If you change `src/lib/grounding.ts`, `review.ts` or the prompt rules in `prompt.ts`, add a test that shows the check still catches what it caught before.

## Set up

You need Node.js 20.9 or newer.

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # unit tests: no network, no API key
npm run typecheck
npm run build
```

Everything except Automatic mode works without an API key. To try Automatic mode, copy `.env.example` to `.env.local` and set `ANTHROPIC_API_KEY`. Please do not run the live evaluation (`npm run eval:live`) in a pull request without saying what it cost.

## Before you open a pull request

1. `npm run typecheck`, `npm test` and `npm run build` pass.
2. If you changed anything visible, run the browser tests against a production build and say so:
   ```bash
   npm run build && npx next start -p 3000
   npm run e2e:layout && npm run e2e:a11y && npm run e2e:contrast
   ```
   They need Chrome or Chromium (set `CHROME_PATH` if it is not in a standard place). Nothing is downloaded.
3. New behaviour has a test. A bug fix has a test that fails without the fix.
4. Match the code around yours: naming, comment density, and the habit of explaining *why* in comments, not *what*.

## Common contributions

### Add skills to the dictionary

The score recognises requirements from `src/lib/skills.ts`. One skill per line: `Display|alias|alias`.

- `!Go` makes a name case-sensitive, for words that are also everyday English.
- `~Search` marks a weak, ambiguous word that only counts when the posting is clearly in that field.
- `Name@sales+finance` places one skill in several fields. A `# --- field` comment sets the field for the lines below it.

Add the common spellings people actually write (`k8s`, `Postgres`). Keep software the most complete; other fields are thinner and would love help.

### Improve extraction, and measure it

`npm run eval:extract` scores the extractor against hand-labelled postings. The postings are employers' text and are not in the repository; run `node evals/fetch-postings.mjs` (and `--blind`) to fetch them for local use, and see [`evals/README.md`](evals/README.md) for the protocol. Please keep **dev** and **sealed** data separate: once you tune against a posting, it no longer measures anything honest. Never commit fetched postings, and never commit real people's resumes. Use fictional ones.

### Add a colour theme

Every colour is a CSS variable. Add a `:root[data-theme="..."]` block in `src/app/globals.css`, add it to `THEMES` in `src/app/theme-picker.tsx` and to the list in `THEME_SCRIPT`, then run `node e2e/contrast.mjs`. It computes the WCAG contrast of every pair and fails if text is hard to read.

## Reporting bugs and ideas

Open an issue with the steps to reproduce. For a wrong score, include the posting text if you can share it, or a description of what was missing. **Do not paste your real resume into a public issue.**

Security problems: see [SECURITY.md](SECURITY.md) and do not open a public issue.

## Code of Conduct

By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
