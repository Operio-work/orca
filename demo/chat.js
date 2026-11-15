'use strict';
// Team chat for the demo (ORCA Host only: `OPERIO_ORCA_HOSTED=1 operio-orca demo`). Two
// fictional teammates per business, a few messages in the team room and on some agents' threads,
// and agents answering an @mention. Written into <config>/clients/<id>/chat by demo/setup.js.
// Times are minutes before the seed; agent threads are keyed by the demo's terminal ids.

const { createChat } = require('../lib/chat');

// Fictional people (login -> name). One word each so an @mention matches the whole name.
const PEOPLE = {
  'harbor-street-bistro': { 'demo:marta': 'Marta', 'demo:luis': 'Luis' },
  'brightside-dental': { 'demo:nadia': 'Nadia', 'demo:priya': 'Priya' },
};

// [minutes ago, author (login or agent:<terminal>), text, { ask: index of the message answered, took: seconds }]
const THREADS = {
  en: {
    'harbor-street-bistro': {
      room: [
        [190, 'demo:marta', 'Friday is fully booked from 7 pm. @Luis can we move the 8:30 party of six to the patio?'],
        [176, 'demo:luis', 'Patio is set. @reservations please tell the Ortega party their table moved to the patio.'],
        [174, 'agent:w1-term1', 'Sent: the Ortega party (six, 8:30 pm Friday) now has a patio table, with heaters on if it gets cool. They replied “perfect, thank you”.', { ask: 1, took: 95 }],
        [38, 'demo:marta', 'Thanks both. The specials post goes out at 4 — @Luis please check the prices before it does.'],
      ],
      't-w1-term2': [
        [64, 'demo:luis', 'Sunday’s 2-star review mentions a 40-minute wait. Let’s apologise and offer dessert on their next visit, nothing more.'],
        [58, 'demo:marta', '@reviews draft it in that tone, short, signed by me.'],
        [56, 'agent:w1-term2', 'Draft ready: “Thank you for telling us, and sorry about the wait on Sunday — that’s not the evening we want for you. Next time you’re in, dessert is on us. — Marta and the Harbor Street team.” It is waiting for approval.', { ask: 1, took: 70 }],
      ],
      't-w1-term4': [
        [120, 'demo:marta', 'Tomatoes went up again. Cap Thursday’s order at $380 unless I say otherwise.'],
      ],
    },
    'brightside-dental': {
      room: [
        [240, 'demo:nadia', 'Two hygienists are out on Wednesday. @Priya can we move the 2–4 pm cleanings to Thursday?'],
        [222, 'demo:priya', 'Yes, Thursday has room. @reminders please text those patients their new Thursday times.'],
        [219, 'agent:w2-term1', 'Texted 5 patients their new Thursday times (same hour, one day later). 3 have confirmed; I’ll list anyone who hasn’t by noon tomorrow.', { ask: 1, took: 150 }],
      ],
      't-w2-term4': [
        [95, 'demo:nadia', 'Put patients more than 9 months overdue at the top of the recall list.'],
      ],
      't-w2-term3': [
        [30, 'demo:priya', 'Mrs. Alvarez’s form is missing her insurance. I’ll call her — skip it for now.'],
      ],
    },
  },
  es: {
    'harbor-street-bistro': {
      room: [
        [190, 'demo:marta', 'El viernes está lleno desde las 7 pm. @Luis ¿podemos pasar la mesa de seis de las 8:30 a la terraza?'],
        [176, 'demo:luis', 'La terraza está lista. @reservas avísale a la familia Ortega que su mesa ahora está en la terraza.'],
        [174, 'agent:w1-term1', 'Enviado: la familia Ortega (seis personas, viernes 8:30 pm) ya tiene mesa en la terraza, con calentadores si refresca. Respondieron “perfecto, gracias”.', { ask: 1, took: 95 }],
        [38, 'demo:marta', 'Gracias a los dos. El post de especiales sale a las 4 — @Luis revisa los precios antes, por favor.'],
      ],
      't-w1-term2': [
        [64, 'demo:luis', 'La reseña de 2 estrellas del domingo menciona 40 minutos de espera. Pidamos disculpas y ofrezcamos el postre en su próxima visita, nada más.'],
        [58, 'demo:marta', '@opiniones redáctala en ese tono, corta y firmada por mí.'],
        [56, 'agent:w1-term2', 'Borrador listo: “Gracias por contarnos, y perdón por la espera del domingo — no es la noche que queremos para ustedes. En su próxima visita, el postre corre por nuestra cuenta. — Marta y el equipo de Harbor Street.” Está esperando aprobación.', { ask: 1, took: 70 }],
      ],
      't-w1-term4': [
        [120, 'demo:marta', 'El jitomate volvió a subir. Limita el pedido del jueves a $380 salvo que yo diga otra cosa.'],
      ],
    },
    'brightside-dental': {
      room: [
        [240, 'demo:nadia', 'Faltan dos higienistas el miércoles. @Priya ¿podemos pasar las limpiezas de 2 a 4 pm al jueves?'],
        [222, 'demo:priya', 'Sí, el jueves hay espacio. @recordatorios manda a esos pacientes su nuevo horario del jueves.'],
        [219, 'agent:w2-term1', 'Mandé mensaje a 5 pacientes con su nuevo horario del jueves (misma hora, un día después). 3 ya confirmaron; mañana a mediodía te paso la lista de quien no.', { ask: 1, took: 150 }],
      ],
      't-w2-term4': [
        [95, 'demo:nadia', 'Pon hasta arriba de la lista a los pacientes con más de 9 meses de atraso.'],
      ],
      't-w2-term3': [
        [30, 'demo:priya', 'Al formulario de la Sra. Alvarez le falta el seguro. Yo la llamo — sáltalo por ahora.'],
      ],
    },
  },
};

const mentionsIn = (text, people) => Object.entries(people)
  .filter(([, name]) => new RegExp(`(^|[^\\p{L}\\p{N}_@])@${name}(?![\\p{L}\\p{N}_])`, 'iu').test(text)).map(([login]) => login);

// agentNames: terminal -> the agent's name in this language (from demo/clients.js forLang).
function seedChat(dir, clientId, lang, agentNames, now = Date.now()) {
  const threads = (THREADS[lang] || THREADS.en)[clientId];
  if (!threads) return 0;
  let clock = now;
  const chat = createChat({ dir, now: () => clock });
  const people = PEOPLE[clientId] || {};
  let n = 0;
  for (const [id, msgs] of Object.entries(threads)) {
    const posted = [];
    for (const [ago, by, text, a] of msgs) {
      clock = now - ago * 60e3;
      const agent = by.startsWith('agent:');
      const x = agent ? { name: agentNames[by.slice(6)] || 'agent', ask: posted[a.ask]?.id || null, out: null, took: a.took * 1000 } : null;
      posted.push(chat.post(id, by, text, agent ? [] : mentionsIn(text, people), x));
      n++;
    }
  }
  return n;
}

module.exports = { PEOPLE, THREADS, seedChat };
