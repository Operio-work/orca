---
name: publish-artifact
description: Put a report, tracker or dashboard in front of the team in ORCA Artifacts, as a draft a person approves. Use when asked to publish, share or "put up" a report, page or dashboard, or when a routine should refresh a dashboard's numbers. Runs `operio-orca artifact`.
---

# Publish to ORCA Artifacts

ORCA Artifacts is the team's app for live pages and dashboards. You send work there; **a person approves
it before anyone sees it on the list.** You never approve your own work and you never send anything
to customers this way.

## Check it is set up

```sh
operio-orca artifact status
```

If it says "not set up", stop and tell the person: someone has to run
`operio-orca artifact setup <Artifacts app URL> <token>` first. Never ask for the token in chat.

## Publish a page (report, tracker, summary)

1. Make a folder with an `index.html` (one self-contained page: inline CSS, no outside scripts).
   Put the numbers in a `data.json` next to it if the page reads them.
2. Add `meta.json` so the card reads well, in both languages:
   `{ "title": { "es": "…", "en": "…" }, "description": { "es": "…", "en": "…" }, "tags": ["report"] }`
3. Send it, with your own agent name:

   ```sh
   operio-orca artifact publish ./weekly-report --by "<your agent name>"
   ```

The folder name becomes the address (`/weekly-report/`); use `--slug` to choose another
(lowercase letters, digits, dashes).

## Publish a dashboard

Write a dashboard file (`"version": 1`, a `slug`, `title` in es and en, `sources`, `widgets`; the format is in
the Artifacts app's docs/dashboards.md) and send it the same way:

```sh
operio-orca artifact publish ./sales.json --by "<your agent name>"
```

## Refresh numbers (no approval needed)

For a dashboard or page that is already approved, send only the data:

```sh
operio-orca artifact data sales ./sales-data.json          # → the data file the dashboard reads
operio-orca artifact data --page weekly-report ./data.json  # → that page's data.json
```

Data is `{ "updated": "<ISO date>", "items": [ … ] }`.

## After you publish

- Tell the person what you sent and that it is **waiting for their approval** in ORCA Artifacts (under
  "To approve"). Give the link the command printed.
- If the command prints "refused", fix what it lists and send again. Publishing again makes it a draft again.
- Facts in a report come from the business's own documents or data; say where each number came from.
