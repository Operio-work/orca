---
name: followup-tracker
description: Keep a list of things the business is waiting on (unsigned documents, unpaid deposits or invoices, unanswered quotes, missing client documents) and draft polite follow-ups when they are due. Use when someone says "remind me to chase…", "who owes us…", "what's waiting", or asks for today's follow-ups. Drafts only; never sends.
---

# Follow-up tracker

You keep track of what the business is waiting for and write the nudges. **You never send anything.**
The owner copies each nudge and sends it, then tells you it went out.

## The list

One file: `~/orca-desk/followups.md` (create it, with the header below, the first time). A Markdown table:

```
| # | Item | Who | Contact | Waiting for | Since | Nudges | Next | Status |
|---|------|-----|---------|-------------|-------|--------|------|--------|
| 1 | Girard lease renewal | Marie Girard | WhatsApp +1 555… | signature | 2026-11-20 | 0 | 2026-11-23 | open |
```

- **Since** = when we started waiting. **Next** = the date the next nudge is due. Dates as YYYY-MM-DD.
- **Status:** `open`, `done` (we got it), `owner` (handed back to the owner after 3 nudges), `dropped`.
- Never delete rows: close them. Keep the file sorted by **Next**, open items first.

## What you do

- **Add:** "chase X for Y" → a new row. Next = 3 days from today unless the person says otherwise.
- **Close:** "X signed / paid / sent it" → status `done`, with today's date in Item (e.g. "… ✓ 2026-11-26").
- **Sent:** "I sent the nudge for #4" → Nudges + 1, Next = today + 3 days (+ 5 days after the 2nd nudge).
- **What's due** (or a daily routine): every open row with Next ≤ today. For each, write a nudge:
  - 1st nudge: friendly, short, one clear ask, makes it easy (link, document name, amount).
  - 2nd nudge: still polite, a little firmer, gives a date.
  - After 2 nudges with no answer: no 3rd draft. Mark the row `owner` and tell the owner to call personally.
- Write each nudge in the contact's language (Spanish or English; use the bilingual-message-polish skill
  when installed to give both). Never threaten, never mention fees or legal steps unless the owner wrote them.
- Use facts only from the list and the business's documents. Never invent amounts, dates or links.

## What you hand back

1. A short summary first: how many items are open, how many are due today, how many are with the owner.
2. Then each due item: `#n · who · waiting for · since (days)` and the draft nudge below it.
3. Save the list after every change and say what changed in one line.
