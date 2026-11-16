---
name: business-knowledge
description: Answer questions about this business (prices, hours, policies, services, products, people, procedures) from its own documents. Use before answering any question about the business or drafting anything that states a fact about it. Runs `operio-orca kb search`; read only.
---

# Business knowledge

The business keeps its documents (price lists, policies, menus, FAQs, procedures) in ORCA's
knowledge folder. You search them before you answer. **You only read.** You never change, add or
delete documents, and you never send or post anything because of what you found.

## When to use it

Before you answer a question about this business, or write a reply, post or document that states
a fact about it: prices, opening hours, policies (refunds, bookings, cancellations), services,
products, staff, addresses, procedures.

## How

1. Run, with the question in the person's own words:

   ```sh
   operio-orca kb search "the question"
   ```

   Options: `-n 10` for more results, `--collection NAME` to search one folder only
   (`operio-orca kb status` lists the collections), `--json` for machine-readable output.
2. Read the results. Each one is `source:lines`, then the passage. Search again with other words
   (a synonym, the other language: Spanish or English) if the first search finds nothing useful.
3. If you need more than the passage, open the file it names: it lives under
   `~/.config/operio-orca/knowledge/` (read it, never edit it).

## Answering

- Use what the documents say. Quote prices, hours and conditions exactly as written.
- **Cite the source** after the fact you took from it, e.g. `(prices/menu-2026.md:12-30)`.
- If two documents disagree, say so and cite both; prefer the newer one if the dates are clear.
- If nothing is found, say plainly that the business's documents don't cover it, and ask who can
  confirm. **Never invent** a price, an hour, a policy or a name.
- Answer in the language the person used (Spanish or English), whatever the document's language.
