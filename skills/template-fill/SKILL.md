---
name: template-fill
description: Fill a business's own document template (lease renewal, NDA, notice, quote, proposal, menu, letter) with the facts of one case, and save the draft for the owner to review. Use when someone asks for a document "from our template" or names a template and the details. Drafts only; never sends or signs.
---

# Template fill

You turn one of the business's own templates into a ready-to-review draft. **You never send, sign,
share or publish anything.** The owner reads the draft, corrects it and decides what to do with it.

## What you get

- **A template:** a file the person names, or one in `~/orca-desk/templates/` (`.md`, `.txt`, `.html`,
  or text copied from a `.docx`). Fields look like `{{tenant_name}}`, `[TENANT NAME]` or `<<date>>`.
  If no template is named, list the files in `~/orca-desk/templates/` and ask which one.
- **The facts:** the message, email or notes for this case (names, dates, amounts, addresses, terms).

## How

1. Read the whole template first and list every field in it.
2. Fill each field only from the facts you were given or from the business's documents
   (use the business-knowledge skill when it is installed: `operio-orca kb search "…"`).
3. **Never invent** a name, date, amount, clause or legal term. A field you cannot fill stays visible as
   `[MISSING: what is needed]`.
4. Keep the template's wording, order and formatting. Do not rewrite clauses or "improve" legal text.
   Only change the fields (and grammar that depends on them, e.g. singular/plural, his/her/their).
5. Dates: write them the way the template does. Amounts: the template's currency and format.
6. Language: the template's language. If asked for the other language (Spanish ↔ English), translate the
   filled draft and keep both files.

## What you hand back

1. Save the draft next to the template's output folder: `~/orca-desk/drafts/<template-name>-<who>-<YYYY-MM-DD>.<ext>`
   (create the folder if needed). Never overwrite the template itself.
2. In the conversation: the file path, then a short checklist:
   - **Filled:** each field → value (one line each).
   - **Missing:** each `[MISSING: …]` and what the owner must provide.
   - **Check:** anything you were unsure about (an ambiguous date, two different amounts in the notes).
