# Security

## Reporting a vulnerability

Please report security problems **privately**, not in a public issue. On GitHub, use **Security → Report a vulnerability** on this repository. Include what you found, how to reproduce it, and what you think the impact is. You will get an answer as soon as someone can look.

## What to know before you deploy this

Resume Fit is built to run on your own machine. These are known and deliberate gaps if you put it on the public internet:

- **The API routes have no authentication and no rate limiting.** `POST /api/tailor` and `POST /api/cover-letter` each make a paid model call using the server's `ANTHROPIC_API_KEY`. Anyone who can reach them can spend your credit. Add authentication and rate limiting first, or leave `ANTHROPIC_API_KEY` unset so Automatic mode is off. `POST /api/analyze` makes no model call and is free to run.
- **Inputs are size-limited** (resume 30,000 characters, posting 20,000) and validated, but the routes are not hardened against a determined abuser.
- **Your own AI mode sends nothing to the server.** Uploads, the score and the check all run in the browser.

## What the app does and does not do with your data

- Errors are logged by class and HTTP status only, never with resume or posting text.
- There is no database, no analytics, and no account system. Saved versions and the colour theme use the browser's local storage.
- Uploaded files are parsed in the browser (PDF and Word) and never leave it.

## Out of scope

Prompt injection through a resume or posting is handled by telling the model to treat that text as data and by checking its output against your original, not by trying to detect hostile text. A report that "the model followed an instruction hidden in a posting" is useful if the result got past the check with an invented fact; it is not a vulnerability if the check flagged it.
