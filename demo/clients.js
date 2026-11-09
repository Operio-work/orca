'use strict';

// The two fictional businesses of `free-orca demo`. Everything here is made up: no real
// people, businesses, phone numbers or addresses (555 numbers, example.com addresses).
//
// Each agent plays one scripted turn, over and over:
//   working (the `work` lines appear at their second marks)
//   → needs you (`ask`: a question with numbered options; answer with a key or a reply)
//   → working (the branch for the answer you gave: `after[n]`, or `text` for a typed reply)
//   → done (held for `hold` seconds) → the next turn starts.
// `delay` staggers the agents so they are never all in the same state. `auto` answers the
// question by itself after that many seconds (keeps an unattended loop moving).
// Seconds are at speed 1; `free-orca demo --speed 2` plays everything twice as fast.

const CLIENTS = [
  {
    id: 'harbor-street-bistro',
    name: 'Harbor Street Bistro',
    short: 'Bistro',
    ws: 'w1',
    folder: 'harbor-street-bistro',
    tabs: [
      { id: 'w1:t1', number: 1, label: 'Front of house' },
      { id: 'w1:t2', number: 2, label: 'Kitchen & office' },
    ],
    agents: [
      {
        name: 'reservations', kind: 'claude', tab: 'w1:t1', pane: 'w1:p1', title: 'Reservation replies',
        delay: 0, hold: 30,
        task: 'Answer tonight’s reservation requests in inbox/reservations/ and update the table plan.',
        spin: 'Checking the table plan',
        work: [
          [1.0, '● Reading 6 new requests in inbox/reservations/'],
          [2.0, '  ⎿  6 messages · for Friday, Nov 13'],
          [3.4, '● Checking the table plan for Friday 6:00–10:00 pm'],
          [4.8, '  ⎿  14 of 18 tables booked · patio closed (forecast 48 °F)'],
          [6.2, '● Drafted confirmations for 4 requests:'],
          [6.8, '    ✓ Dana R. · 2 guests · 7:00 pm · table 6'],
          [7.3, '    ✓ Priya N. · 4 guests · 7:30 pm · table 11'],
          [7.8, '    ✓ Lee family · 5 guests · 6:15 pm · table 2 (high chair noted)'],
          [8.3, '    ✓ T. Okafor · 2 guests · 8:45 pm · bar seats'],
          [9.6, '● One request needs a decision: a party of 8 at 8:00 pm (Morgan, birthday).'],
          [10.2, '  The only fit is joining tables 4 and 5, which uses the 8:15 walk-in buffer.'],
        ],
        ask: {
          question: 'How should I answer the Morgan party?',
          options: ['Join tables 4 + 5 at 8:00 pm', 'Offer 6:30 pm instead', 'Put them on the waitlist'],
        },
        after: {
          1: [
            [0.8, '● Booking Morgan · 8 guests · 8:00 pm · tables 4 + 5'],
            [1.8, '  ⎿  Table plan updated · walk-in buffer moved to 9:15 pm'],
            [3.0, '● Reply draft: “Happy early birthday! Your table for 8 is set for 8:00 pm on Friday.'],
            [3.1, '  We’ll have a candle ready for dessert.”'],
            [4.4, '● Wrote 5 confirmation drafts to outbox/reservations/ — nothing sent.'],
            [5.4, '● Done: 5 confirmed, 1 still open (Kim · 3 guests · no time given).'],
          ],
          2: [
            [0.8, '● Holding 6:30 pm for Morgan · 8 guests · tables 4 + 5'],
            [1.8, '  ⎿  8:00 pm stays free for walk-ins'],
            [3.0, '● Reply draft: “We’d love to host your birthday! 8:00 pm is full, but we can seat'],
            [3.1, '  all 8 of you at 6:30 pm, and dessert is on us.”'],
            [4.4, '● Wrote 5 reply drafts to outbox/reservations/ — nothing sent.'],
            [5.4, '● Done: 4 confirmed, 1 offered 6:30 pm, 1 still open (Kim · 3 guests).'],
          ],
          3: [
            [0.8, '● Adding Morgan · 8 guests · 8:00 pm to the Friday waitlist (position 1)'],
            [2.0, '● Reply draft: “Friday at 8:00 is full right now. You’re first on our waitlist and'],
            [2.1, '  we’ll call you at (555) 010-0123 the moment a large table opens.”'],
            [3.6, '● Wrote 5 reply drafts to outbox/reservations/ — nothing sent.'],
            [4.6, '● Done: 4 confirmed, 1 waitlisted, 1 still open (Kim · 3 guests).'],
          ],
        },
        text: reply => [
          [0.8, `● Following your note for the Morgan party: “${reply}”`],
          [2.2, '● Reply draft for Morgan rewritten with your note, in the bistro’s voice.'],
          [3.6, '● Wrote 5 reply drafts to outbox/reservations/ — nothing sent.'],
          [4.6, '● Done: 4 confirmed, Morgan answered your way, 1 still open (Kim · 3 guests).'],
        ],
      },
      {
        name: 'reviews', kind: 'claude', tab: 'w1:t1', pane: 'w1:p2', title: 'Google review replies',
        delay: 18, hold: 34,
        task: 'Draft replies to the Google reviews that came in since Monday.',
        spin: 'Drafting replies',
        work: [
          [1.2, '● Reading reviews/new.txt'],
          [2.0, '  ⎿  5 new reviews · ★★★★★ ×3 · ★★★★ ×1 · ★★ ×1'],
          [3.6, '● Drafted replies for the 4 good ones:'],
          [4.2, '    ★★★★★ Alex P. — “the clam chowder is the best in town” → thanks + chowder'],
          [4.7, '    ★★★★★ Jamie W. — anniversary dinner → thanks + hope to see you next year'],
          [5.2, '    ★★★★★ Chris D. — dog-friendly patio → thanks + water bowls mention'],
          [5.7, '    ★★★★  Robin S. — loved the food, music a bit loud → thanks + noted'],
          [7.2, '● The 2-star review: “Waited 40 minutes for our mains on Saturday. Food was'],
          [7.3, '  good but nobody told us why.” — Taylor B.'],
        ],
        ask: {
          question: 'How should the reply to Taylor’s 2-star review go?',
          options: ['Apologize and invite them back', 'Apologize and explain the short-staffed Saturday', 'Leave it for the manager'],
        },
        after: {
          1: [
            [0.8, '● Draft for Taylor B.:'],
            [1.4, '  “Taylor, we’re sorry — 40 minutes is too long, and you should have heard from us.'],
            [1.5, '  We’d love a chance to do better. Call us at (555) 010-0123 and ask for Jo.”'],
            [3.0, '● Saved 5 drafts to drafts/reviews-nov-12.md — waiting for your approval.'],
            [4.0, '● Done. Nothing was posted.'],
          ],
          2: [
            [0.8, '● Draft for Taylor B.:'],
            [1.4, '  “Taylor, we’re sorry about the wait. Two of our cooks were out sick on Saturday,'],
            [1.5, '  and we should have told every table. Thank you for your patience.”'],
            [3.0, '● Saved 5 drafts to drafts/reviews-nov-12.md — waiting for your approval.'],
            [4.0, '● Done. Nothing was posted.'],
          ],
          3: [
            [0.8, '● Leaving Taylor B. for the manager, with a note:'],
            [1.4, '  “2-star, Saturday wait of 40 min. Suggest a personal reply within 24 hours.”'],
            [3.0, '● Saved 4 drafts + 1 manager note to drafts/reviews-nov-12.md.'],
            [4.0, '● Done. Nothing was posted.'],
          ],
        },
        text: reply => [
          [0.8, '● Draft for Taylor B., using your words:'],
          [1.4, `  “${reply}”`],
          [3.0, '● Saved 5 drafts to drafts/reviews-nov-12.md — waiting for your approval.'],
          [4.0, '● Done. Nothing was posted.'],
        ],
      },
      {
        name: 'menu-post', kind: 'codex', tab: 'w1:t2', pane: 'w1:p3', title: 'Weekly specials post',
        delay: 6, hold: 40, auto: 45,
        task: 'Write this week’s specials post for Instagram and the website.',
        spin: 'Writing the caption',
        work: [
          [1.0, '• Reading kitchen/specials-week-46.md'],
          [2.0, '  └ Seared halibut · Butternut squash risotto · Warm apple crumble'],
          [3.8, '• Caption draft (EN):'],
          [4.4, '  “Friday nights at Harbor Street: seared halibut with brown butter, a risotto'],
          [4.5, '  that tastes like fall, and apple crumble straight from the oven. Book a table'],
          [4.6, '  at harborstreetbistro.example.com 🍂”'],
          [6.0, '• Website snippet updated in drafts/specials.html'],
          [7.4, '• Found 3 photos in photos/week-46/'],
        ],
        ask: {
          question: 'Which photo should lead the post?',
          options: ['halibut-plated.jpg (bright, top-down)', 'risotto-closeup.jpg (warm, close)', 'dining-room-evening.jpg (the room)'],
        },
        after: {
          1: [
            [0.8, '• Lead photo: halibut-plated.jpg · crop 4:5 · alt text written'],
            [2.2, '• Saved drafts/menu-post-week-46.md (caption, photo, hashtags)'],
            [3.2, '• Done — waiting for your approval. Nothing was posted.'],
          ],
          2: [
            [0.8, '• Lead photo: risotto-closeup.jpg · crop 4:5 · alt text written'],
            [1.6, '• Caption now opens with the risotto: “A risotto that tastes like fall…”'],
            [2.8, '• Saved drafts/menu-post-week-46.md (caption, photo, hashtags)'],
            [3.8, '• Done — waiting for your approval. Nothing was posted.'],
          ],
          3: [
            [0.8, '• Lead photo: dining-room-evening.jpg · crop 4:5 · alt text written'],
            [1.6, '• Caption now opens with the room: “Friday nights at Harbor Street…”'],
            [2.8, '• Saved drafts/menu-post-week-46.md (caption, photo, hashtags)'],
            [3.8, '• Done — waiting for your approval. Nothing was posted.'],
          ],
        },
        text: reply => [
          [0.8, `• Noted: “${reply}”`],
          [2.0, '• Caption and photo choice updated to match.'],
          [3.0, '• Saved drafts/menu-post-week-46.md — waiting for your approval.'],
        ],
      },
      {
        name: 'supplier-orders', kind: 'claude', tab: 'w1:t2', pane: 'w1:p4', title: 'Thursday produce order',
        delay: 30, hold: 36,
        task: 'Build Thursday’s produce and dairy order from tonight’s stock count.',
        spin: 'Comparing stock to par levels',
        work: [
          [1.0, '● Reading stock/count-nov-11.csv'],
          [2.0, '  ⎿  42 items counted · 9 below par'],
          [3.6, '● Below par: lemons, heavy cream, shallots, thyme, butter, eggs, arugula,'],
          [3.7, '  butternut squash, halibut (6 kg short)'],
          [5.2, '● Checking this week’s price list from Green Valley Produce'],
          [6.4, '  ⎿  Order cutoff Wednesday 2:00 pm · 3 prices changed'],
          [7.8, '● Halibut is up 18% this week: $24.50/lb (was $20.75).'],
          [8.4, '  Cod is available at $14.00/lb.'],
        ],
        ask: {
          question: 'Halibut is up 18% this week. What should I order?',
          options: ['6 kg of halibut, as usual', '4 kg of halibut and end the special early', 'Swap to cod for the week'],
        },
        after: {
          1: [
            [0.8, '● Order: 9 lines, halibut 6 kg · est. total $1,486.20'],
            [2.0, '● Wrote orders/thursday-order.csv and an email draft to'],
            [2.1, '  orders@greenvalley.example.com — not sent.'],
            [3.4, '● Done. Food cost this week: 31.8% (target 30%).'],
          ],
          2: [
            [0.8, '● Order: 9 lines, halibut 4 kg · est. total $1,262.40'],
            [1.6, '● Note for the kitchen: “Halibut special ends Saturday or when it runs out.”'],
            [2.8, '● Wrote orders/thursday-order.csv and an email draft to'],
            [2.9, '  orders@greenvalley.example.com — not sent.'],
            [4.0, '● Done. Food cost this week: 30.6% (target 30%).'],
          ],
          3: [
            [0.8, '● Order: 9 lines, cod 6 kg instead of halibut · est. total $1,104.70'],
            [1.6, '● Flagged for menu-post: the special changes to seared cod.'],
            [2.8, '● Wrote orders/thursday-order.csv and an email draft to'],
            [2.9, '  orders@greenvalley.example.com — not sent.'],
            [4.0, '● Done. Food cost this week: 29.4% (target 30%).'],
          ],
        },
        text: reply => [
          [0.8, `● Going with your call: “${reply}”`],
          [2.0, '● Wrote orders/thursday-order.csv and an email draft to'],
          [2.1, '  orders@greenvalley.example.com — not sent.'],
          [3.4, '● Done.'],
        ],
      },
    ],
  },
  {
    id: 'brightside-dental',
    name: 'Brightside Dental',
    short: 'Dental',
    ws: 'w2',
    folder: 'brightside-dental',
    tabs: [
      { id: 'w2:t1', number: 1, label: 'Patients' },
      { id: 'w2:t2', number: 2, label: 'Front desk' },
    ],
    agents: [
      {
        name: 'reminders', kind: 'claude', tab: 'w2:t1', pane: 'w2:p1', title: 'Tomorrow’s reminders',
        delay: 0, hold: 32,
        task: 'Prepare reminders for tomorrow’s appointments.',
        spin: 'Drafting reminders',
        work: [
          [1.0, '● Reading schedule/2026-11-13.csv'],
          [2.0, '  ⎿  23 appointments · 2 dentists · 2 hygienists'],
          [3.4, '● Drafted 21 reminders (text + email), each with the time, the dentist and'],
          [3.5, '  “Reply C to confirm or call (555) 010-0188 to reschedule.”'],
          [5.0, '● 1 patient has no phone on file → email only (r.alvarez@example.com)'],
          [6.6, '● Jordan M. asked last week to move to an afternoon. Tomorrow’s 9:00 am'],
          [6.7, '  is still on the books, and 2:30 pm with Dr. Chen is open.'],
        ],
        ask: {
          question: 'What should Jordan’s reminder say?',
          options: ['Keep 9:00 am as booked', 'Offer the open 2:30 pm slot', 'Skip it and flag for a call'],
        },
        after: {
          1: [
            [0.8, '● Jordan M.: standard reminder for 9:00 am with Dr. Chen'],
            [2.0, '● Saved 23 reminder drafts to reminders/2026-11-13/ — nothing sent.'],
            [3.0, '● Done.'],
          ],
          2: [
            [0.8, '● Jordan M.: “You asked about an afternoon visit — we can move you to'],
            [0.9, '  2:30 pm tomorrow with Dr. Chen. Reply YES to switch, or keep 9:00 am.”'],
            [2.0, '● Held 2:30 pm for Jordan until 6:00 pm today.'],
            [3.0, '● Saved 23 reminder drafts to reminders/2026-11-13/ — nothing sent.'],
            [4.0, '● Done.'],
          ],
          3: [
            [0.8, '● Jordan M.: no reminder. Added to the front-desk call list with the note'],
            [0.9, '  “Asked for an afternoon. 2:30 pm with Dr. Chen is open.”'],
            [2.2, '● Saved 22 reminder drafts to reminders/2026-11-13/ — nothing sent.'],
            [3.2, '● Done.'],
          ],
        },
        text: reply => [
          [0.8, `● Jordan M.’s reminder now reads: “${reply}”`],
          [2.0, '● Saved 23 reminder drafts to reminders/2026-11-13/ — nothing sent.'],
          [3.0, '● Done.'],
        ],
      },
      {
        name: 'review-replies', kind: 'claude', tab: 'w2:t2', pane: 'w2:p2', title: 'Review replies',
        delay: 20, hold: 34,
        task: 'Draft replies to this week’s Google reviews.',
        spin: 'Drafting replies',
        work: [
          [1.2, '● Reading reviews/week-46.txt'],
          [2.0, '  ⎿  4 new reviews · ★★★★★ ×3 · ★★ ×1'],
          [3.4, '● Drafted 3 thank-you replies (first names only, no treatment details).'],
          [5.0, '● The 2-star review: “The cleaning was great but I got a bill I didn’t'],
          [5.1, '  expect. Nobody explained what insurance would cover.” — Morgan T.'],
        ],
        ask: {
          question: 'How should I reply to Morgan’s billing review?',
          options: ['Apologize and offer a call with the office manager', 'Thank them and explain how estimates work', 'Leave it for the office manager'],
        },
        after: {
          1: [
            [0.8, '● Draft for Morgan T.:'],
            [1.4, '  “Morgan, we’re sorry the bill was a surprise. Our office manager would like to'],
            [1.5, '  walk you through it: please call (555) 010-0147 at a time that suits you.”'],
            [3.0, '● Saved 4 drafts to drafts/reviews-week-46.md — waiting for your approval.'],
            [4.0, '● Done. Nothing was posted.'],
          ],
          2: [
            [0.8, '● Draft for Morgan T.:'],
            [1.4, '  “Thank you, Morgan. Before each visit we can send a written estimate of what'],
            [1.5, '  insurance covers — just ask the front desk, or call (555) 010-0147.”'],
            [3.0, '● Saved 4 drafts to drafts/reviews-week-46.md — waiting for your approval.'],
            [4.0, '● Done. Nothing was posted.'],
          ],
          3: [
            [0.8, '● Leaving Morgan T. for the office manager, with a note:'],
            [1.4, '  “Billing surprise after a cleaning. Reply privately first, then publicly.”'],
            [3.0, '● Saved 3 drafts + 1 note to drafts/reviews-week-46.md.'],
            [4.0, '● Done. Nothing was posted.'],
          ],
        },
        text: reply => [
          [0.8, '● Draft for Morgan T., in your words:'],
          [1.4, `  “${reply}”`],
          [3.0, '● Saved 4 drafts to drafts/reviews-week-46.md — waiting for your approval.'],
          [4.0, '● Done. Nothing was posted.'],
        ],
      },
      {
        name: 'intake-forms', kind: 'codex', tab: 'w2:t2', pane: 'w2:p3', title: 'New-patient intake check',
        delay: 8, hold: 40, auto: 45,
        task: 'Check this week’s new-patient intake forms before their first visit.',
        spin: 'Checking forms',
        work: [
          [1.0, '• Reading intake/week-46/'],
          [2.0, '  └ 7 forms'],
          [3.4, '• 5 complete ✓'],
          [4.4, '• Riley S.: insurance member ID missing → added to the front-desk list'],
          [6.0, '• Casey L.: lists a penicillin allergy, but the medication list is empty.'],
        ],
        ask: {
          question: 'What should I do about Casey L.’s form?',
          options: ['Flag it for the hygienist at check-in', 'Draft an email asking Casey to confirm', 'Both'],
        },
        after: {
          1: [
            [0.8, '• Added a check-in flag for Casey L. (allergy: penicillin · confirm medications)'],
            [2.0, '• Report saved to reports/intake-week-46.md'],
            [3.0, '• Done.'],
          ],
          2: [
            [0.8, '• Email draft to casey.l@example.com: “Could you confirm any medications you'],
            [0.9, '  take? You can reply here or call (555) 010-0188.” — not sent.'],
            [2.0, '• Report saved to reports/intake-week-46.md'],
            [3.0, '• Done.'],
          ],
          3: [
            [0.8, '• Added a check-in flag for Casey L. (allergy: penicillin · confirm medications)'],
            [1.6, '• Email draft to casey.l@example.com asking to confirm medications — not sent.'],
            [2.8, '• Report saved to reports/intake-week-46.md'],
            [3.8, '• Done.'],
          ],
        },
        text: reply => [
          [0.8, `• Noted for Casey L.: “${reply}”`],
          [2.0, '• Report saved to reports/intake-week-46.md'],
          [3.0, '• Done.'],
        ],
      },
      {
        name: 'recall', kind: 'claude', tab: 'w2:t1', pane: 'w2:p4', title: 'Cleaning recall list',
        delay: 32, hold: 36,
        task: 'Find patients overdue for their 6-month cleaning and draft recall messages.',
        spin: 'Sorting the recall list',
        work: [
          [1.0, '● Reading patients/active.csv and hygiene/visits.csv'],
          [2.2, '  ⎿  1,240 active patients'],
          [3.6, '● 86 are overdue for a cleaning:'],
          [4.1, '    55 overdue 6–12 months · 31 overdue more than 12 months'],
          [5.6, '● 44 open hygiene slots this month (Tue–Sat)'],
          [7.0, '● Drafted a friendly recall message with a booking link'],
          [7.1, '  (brightsidedental.example.com/book) and the office number (555) 010-0188.'],
        ],
        ask: {
          question: 'How should I batch the 86 recall drafts?',
          options: ['30 a day, starting Monday', 'The 31 most overdue first', 'Only as many as open slots (44)'],
        },
        after: {
          1: [
            [0.8, '● 3 batches: Mon 30 · Tue 30 · Wed 26'],
            [2.0, '● Saved recall/drafts-week-47/ (86 drafts) — nothing sent.'],
            [3.0, '● Done.'],
          ],
          2: [
            [0.8, '● Batch 1: the 31 patients overdue more than 12 months'],
            [1.6, '● Batch 2 (55) waits until batch 1 has booked.'],
            [2.8, '● Saved recall/drafts-week-47/ (31 drafts) — nothing sent.'],
            [3.8, '● Done.'],
          ],
          3: [
            [0.8, '● 44 drafts, most overdue first, matched to the open slots'],
            [2.0, '● Saved recall/drafts-week-47/ (44 drafts) — nothing sent.'],
            [3.0, '● Done. 42 patients wait for next month’s schedule.'],
          ],
        },
        text: reply => [
          [0.8, `● Batching the way you said: “${reply}”`],
          [2.0, '● Saved recall/drafts-week-47/ — nothing sent.'],
          [3.0, '● Done.'],
        ],
      },
    ],
  },
];

// ── Routines tab: demo-only packs, history and drafts per client ─────────────────
// The shipped packs are copied from routines/ for both clients; these are added.
const ROUTINES = {
  'harbor-street-bistro': [
    {
      id: 'reservation-confirmations',
      name: { en: 'Reservation Confirmations', es: 'Confirmación de reservas' },
      problem: { en: 'Reservation requests wait for hours and guests book somewhere else.', es: 'Las solicitudes de reserva esperan horas y los clientes reservan en otro lugar.' },
      prompt: 'Read the reservation requests in ~/harbor-street-bistro/inbox/reservations and the table plan. Draft a short, warm confirmation or alternative for each request. Never send anything.',
      schedule: '0 16 * * *', approval: 'draft', agent: 'claude', cwd: '~/harbor-street-bistro',
    },
    {
      id: 'weekend-prep-list',
      name: { en: 'Weekend Prep List', es: 'Lista de preparación del fin de semana' },
      problem: { en: 'The kitchen finds out what it is short of on Saturday at 6 pm.', es: 'La cocina descubre lo que le falta el sábado a las 6 pm.' },
      prompt: 'Compare the weekend covers forecast with the stock count in ~/harbor-street-bistro/stock and write a prep list per station. Report only.',
      schedule: '0 9 * * 5,6', approval: 'none', agent: 'claude', cwd: '~/harbor-street-bistro',
    },
  ],
  'brightside-dental': [
    {
      id: 'reminder-drafts',
      name: { en: 'Appointment Reminder Drafts', es: 'Borradores de recordatorios de citas' },
      problem: { en: 'No-shows cost a chair hour each, and reminders are written by hand.', es: 'Cada inasistencia cuesta una hora de sillón y los recordatorios se escriben a mano.' },
      prompt: 'Read tomorrow’s schedule in ~/brightside-dental/schedule and draft one reminder per appointment (time, dentist, how to confirm). No treatment details. Never send anything.',
      schedule: '0 17 * * 1-5', approval: 'draft', agent: 'claude', cwd: '~/brightside-dental',
    },
    {
      id: 'recall-list',
      name: { en: 'Cleaning Recall List', es: 'Lista de limpiezas pendientes' },
      problem: { en: 'Patients drift past their 6-month cleaning and nobody notices.', es: 'Los pacientes pasan de su limpieza de 6 meses y nadie lo nota.' },
      prompt: 'List patients overdue for their 6-month cleaning from ~/brightside-dental/patients and draft recall messages in batches. Never send anything.',
      schedule: '30 8 1,15 * *', approval: 'draft', agent: 'claude', cwd: '~/brightside-dental',
    },
  ],
};

// Your choices per client (on/off, schedule overrides).
const ROUTINE_CHOICES = {
  'harbor-street-bistro': {
    'review-reply-desk': { enabled: true },
    'morning-front-desk-brief': { enabled: true },
    'reservation-confirmations': { enabled: true },
    'weekend-prep-list': { enabled: true },
  },
  'brightside-dental': {
    'review-reply-desk': { enabled: true, schedule: '30 8 * * 1-5' },
    'reminder-drafts': { enabled: true },
    'recall-list': { enabled: true },
    'weekly-owner-report': { enabled: true },
  },
};

// Past runs: [routine id, which past scheduled run (0 = the latest), final state, trigger].
// The one 'ready' run per client is the draft waiting for approval.
const HISTORY = {
  'harbor-street-bistro': [
    ['review-reply-desk', 0, 'ready', 'schedule'],
    ['morning-front-desk-brief', 0, 'done', 'schedule'],
    ['reservation-confirmations', 0, 'approved', 'schedule'],
    ['weekend-prep-list', 0, 'done', 'schedule'],
    ['review-reply-desk', 1, 'approved', 'schedule'],
    ['reservation-confirmations', 1, 'rejected', 'manual'],
    ['morning-front-desk-brief', 1, 'done', 'schedule'],
  ],
  'brightside-dental': [
    ['reminder-drafts', 0, 'ready', 'schedule'],
    ['review-reply-desk', 0, 'approved', 'schedule'],
    ['weekly-owner-report', 0, 'done', 'schedule'],
    ['reminder-drafts', 1, 'approved', 'schedule'],
    ['recall-list', 0, 'rejected', 'schedule'],
    ['review-reply-desk', 1, 'approved', 'manual'],
  ],
};

const DRAFTS = {
  'review-reply-desk@harbor-street-bistro': `# Review replies — Harbor Street Bistro

**Needs a reply first (1–3 stars)**

**Taylor B. · ★★ · Nov 8**
> Waited 40 minutes for our mains on Saturday. Food was good but nobody told us why.

Draft: Taylor, we're sorry — 40 minutes is too long, and you should have heard from us while
you waited. We'd love a chance to do better: please reach us at [PHONE or WHATSAPP].
— Harbor Street Bistro

**Alex P. · ★★★★★ · Nov 9**
> The clam chowder is the best in town.

Draft: Thank you, Alex! The chowder recipe hasn't changed in years, and we're glad it still
hits the spot. See you soon. — Harbor Street Bistro

**Robin S. · ★★★★ · Nov 10**
> Loved the food, the music was a bit loud.

Draft: Thanks, Robin! Glad you enjoyed dinner, and thank you for the note on the music;
we've turned it down for the dinner service. — Harbor Street Bistro
`,
  'reservation-confirmations@harbor-street-bistro': `# Reservation confirmations — Friday

- Dana R. · 2 guests · 7:00 pm · "See you Friday at 7! Your table by the window is ready."
- Priya N. · 4 guests · 7:30 pm · "All set for 4 at 7:30 pm."
- Lee family · 5 guests · 6:15 pm · "A high chair will be waiting."
`,
  'morning-front-desk-brief@harbor-street-bistro': `# Morning brief — Harbor Street Bistro

- 64 covers booked tonight (Fri). Patio closed: forecast 48 °F.
- 2 voicemails: a supplier delivery time, and a guest asking about gluten-free options.
- 3 new Google reviews (avg 4.3).
- To do before 4 pm: confirm the party of 8 (Morgan, 8:00 pm).
`,
  'weekend-prep-list@harbor-street-bistro': `# Weekend prep list

- Grill: 22 halibut portions, 40 steak portions
- Sauté: 6 qt risotto base, 3 qt brown butter
- Pastry: 4 trays apple crumble
`,
  'reminder-drafts@brightside-dental': `# Appointment reminders — tomorrow

1. Avery K. · 8:00 am · Dr. Chen — "Hi Avery, a reminder of your visit tomorrow at 8:00 am with
   Dr. Chen at Brightside Dental. Reply C to confirm or call (555) 010-0188 to reschedule."
2. Jordan M. · 9:00 am · Dr. Chen — "Hi Jordan, you asked about an afternoon visit: we can move
   you to 2:30 pm tomorrow. Reply YES to switch, or C to keep 9:00 am."
3. Quinn W. · 10:30 am · hygiene — "Hi Quinn, see you tomorrow at 10:30 am for your cleaning.
   Reply C to confirm."

21 more reminders follow the same format. Nothing has been sent.
`,
  'review-reply-desk@brightside-dental': `# Review replies — Brightside Dental

**Lee H. · ★★★★★**
Draft: Thank you, Lee! We're so glad your visit felt relaxed. See you at your next cleaning.
— Brightside Dental
`,
  'weekly-owner-report@brightside-dental': `# Weekly owner report — week 45

**The week in five numbers**
- Appointments: 118 (+6 on the week before)
- Sales: $9,840 (+4%)
- New patient inquiries: 14 (+3)
- New reviews: 5, average 4.8 ★
- Unpaid: $1,160 (3 patients)

**What went well**
- Saturday slots filled first again.

**What needs attention**
- 2 orthodontic inquiries from Thursday are still unanswered.

**Priorities this week**
1. Answer the 2 orthodontic inquiries.
2. Follow up the 3 unpaid balances.
3. Open more Saturday slots.
`,
  'recall-list@brightside-dental': `# Recall list

86 patients overdue. Batch 1 (31, overdue more than 12 months) drafted.
`,
};

// ── Languages: `free-orca demo --lang es` ─────────────────────────────────────
// English is the script; another language only swaps the words. Every second mark comes from
// the English lines, so a Spanish take lines up with an English one beat for beat.
const LANGS = ['en', 'es'];
const UI_EN = {
  ready: 'ready for the next run',
  routine: 'routine',
  noted: '● Noted — I’ll take that into account.',
  typeSomething: 'Type something.',
  hint: ' Enter to select · Esc to cancel',
  chose: 'You chose',
  picked: 'Picked by default',
  workingOnAnswer: 'Working on your answer',
  working: 'Working',
  interrupt: 'esc to interrupt',
  dynReady: 'ready',
  routineRead: '● Reading the routine’s instructions and input files',
  routineFiles: '  ⎿  4 files',
  routineWriting: '● Writing the draft',
  routineWrote: '● Wrote',
  routineDone: '● Done. It waits in Routines for your approval — nothing was sent.',
  dynScripted: '● This is the Free-ORCA demo: its agents are scripted, so I can’t act on that.',
  dynTry: '  Try answering an agent that needs you.',
  fallbackDraft: name => `# ${name}\n\nDemo draft written by a scripted agent. Nothing was sent.\n`,
  fallbackReport: name => `# ${name}\n\nDemo output. Nothing was sent.\n`,
};

const normLang = l => (LANGS.includes(l) ? l : 'en');
// The leading marker of a script line ("● ", "  ⎿  ", "    ✓ ", "  " …): must match between languages.
const marker = text => (/^\s*(?:[●•⎿└✓★❯]\s*)?/.exec(text) || [''])[0].replace(/[^\s●•⎿└✓★]/g, '');
function retext(en, words, where) {
  if (!Array.isArray(words) || words.length !== en.length) throw new Error(`demo/clients.es.js: ${where} needs ${en.length} lines, has ${words?.length}`);
  return en.map(([s, text], i) => {
    if (marker(text) !== marker(words[i])) throw new Error(`demo/clients.es.js: ${where} line ${i + 1} must start like "${marker(text)}"`);
    return [s, words[i]];
  });
}
function localAgent(a, t) {
  if (!t) throw new Error(`demo/clients.es.js: no text for ${a.pane}`);
  const after = {};
  for (const n of Object.keys(a.after)) after[n] = retext(a.after[n], t.after[n], `${a.pane} after[${n}]`);
  if (t.ask.options.length !== a.ask.options.length) throw new Error(`demo/clients.es.js: ${a.pane} needs ${a.ask.options.length} options`);
  return {
    ...a, name: t.name, title: t.title, task: t.task, spin: t.spin,
    work: retext(a.work, t.work, `${a.pane} work`),
    ask: { question: t.ask.question, options: [...t.ask.options] },
    after,
    text: reply => retext(a.text(reply), t.text(reply), `${a.pane} text`),
  };
}

// Routine names by their English name (the panel tells an agent which routine it runs in
// English): the shipped packs and the demo's own.
function routineNames(lang) {
  const names = new Map();
  const add = n => { if (n && n.en) names.set(n.en, n[lang] || n.en); };
  try {
    const dir = require('path').join(__dirname, '..', 'routines');
    for (const id of require('fs').readdirSync(dir)) {
      try { add(JSON.parse(require('fs').readFileSync(require('path').join(dir, id, 'routine.json'), 'utf8')).name); } catch { /* not a pack */ }
    }
  } catch { /* no packs */ }
  for (const list of Object.values(ROUTINES)) for (const r of list) add(r.name);
  return en => names.get(en) || en;
}

const cache = new Map();
// Everything the demo shows, in one language: { lang, CLIENTS, ROUTINES, DRAFTS, UI, prompt(id) }.
function forLang(lang) {
  lang = normLang(lang);
  if (cache.has(lang)) return cache.get(lang);
  let out;
  if (lang === 'en') {
    out = { lang, CLIENTS, ROUTINES, DRAFTS, UI: UI_EN, prompt: () => null, routineName: en => en };
  } else {
    const { ES } = require('./clients.es');
    const clients = CLIENTS.map(c => ({
      ...c,
      tabs: c.tabs.map(tb => ({ ...tb, label: ES.tabs[tb.id] || tb.label })),
      agents: c.agents.map(a => localAgent(a, ES.agents[a.pane])),
    }));
    const routines = {};
    for (const [id, list] of Object.entries(ROUTINES)) routines[id] = list.map(r => ({ ...r, prompt: ES.prompts[r.id] || r.prompt }));
    out = { lang, CLIENTS: clients, ROUTINES: routines, DRAFTS: { ...DRAFTS, ...ES.drafts }, UI: { ...UI_EN, ...ES.ui }, prompt: id => ES.prompts[id] || null, routineName: routineNames(lang) };
  }
  cache.set(lang, out);
  return out;
}

module.exports = { CLIENTS, ROUTINES, ROUTINE_CHOICES, HISTORY, DRAFTS, LANGS, forLang, normLang };
