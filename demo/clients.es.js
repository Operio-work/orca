'use strict';

// Spanish (Mexico) text for `free-orca demo --lang es`. Only words live here: every second
// mark, state, delay and hold comes from the English script in clients.js, so both languages
// play the same timeline and recorded takes line up. Each list below has exactly as many lines
// as its English twin, with the same leading markers (clients.js checks this on load).
// Business names stay as they are; customers keep neutral names; contacts stay fictional
// (555 numbers, example.com addresses).

const ES = {
  tabs: {
    'w1:t1': 'Sala',
    'w1:t2': 'Cocina y oficina',
    'w2:t1': 'Pacientes',
    'w2:t2': 'Recepción',
  },

  // The chrome around every scripted turn (what the terminal shows besides the script).
  ui: {
    ready: 'listo para la siguiente ronda',
    routine: 'rutina',
    noted: '● Anotado, lo tomo en cuenta.',
    typeSomething: 'Escribe algo.',
    hint: ' Enter para elegir · Esc para cancelar',
    chose: 'Elegiste',
    picked: 'Opción por defecto',
    workingOnAnswer: 'Trabajando en tu respuesta',
    working: 'Trabajando',
    interrupt: 'esc para interrumpir',
    dynReady: 'listo',
    routineRead: '● Leyendo las instrucciones y los archivos de la rutina',
    routineFiles: '  ⎿  4 archivos',
    routineWriting: '● Escribiendo el borrador',
    routineWrote: '● Guardé',
    routineDone: '● Listo. Queda en Rutinas esperando tu aprobación; no se envió nada.',
    dynScripted: '● Esta es la demo de Free-ORCA: sus agentes siguen un guion, así que no puedo hacer eso.',
    dynTry: '  Prueba a responderle a un agente que te necesita.',
    fallbackDraft: name => `# ${name}\n\nBorrador de demostración escrito por un agente con guion. No se envió nada.\n`,
    fallbackReport: name => `# ${name}\n\nResultado de demostración. No se envió nada.\n`,
  },

  agents: {
    // ── Harbor Street Bistro ──────────────────────────────────────────────────
    'w1:p1': {
      name: 'reservas', title: 'Respuestas a reservas',
      task: 'Responde las solicitudes de reserva de esta noche en inbox/reservations/ y actualiza el plano de mesas.',
      spin: 'Revisando el plano de mesas',
      work: [
        '● Leyendo 6 solicitudes nuevas en inbox/reservations/',
        '  ⎿  6 mensajes · para el viernes 13 de noviembre',
        '● Revisando el plano de mesas del viernes, de 6:00 a 10:00 pm',
        '  ⎿  14 de 18 mesas reservadas · terraza cerrada (pronóstico: 9 °C)',
        '● Preparé confirmaciones para 4 solicitudes:',
        '    ✓ Dana R. · 2 personas · 7:00 pm · mesa 6',
        '    ✓ Priya N. · 4 personas · 7:30 pm · mesa 11',
        '    ✓ Familia Lee · 5 personas · 6:15 pm · mesa 2 (silla para bebé anotada)',
        '    ✓ T. Okafor · 2 personas · 8:45 pm · barra',
        '● Una solicitud necesita tu decisión: un grupo de 8 a las 8:00 pm (Morgan, cumpleaños).',
        '  Lo único que cabe es juntar las mesas 4 y 5, y eso usa el margen para clientes sin reserva de las 8:15.',
      ],
      ask: {
        question: '¿Cómo le respondo al grupo de Morgan?',
        options: ['Juntar las mesas 4 + 5 a las 8:00 pm', 'Ofrecerles las 6:30 pm', 'Ponerlos en lista de espera'],
      },
      after: {
        1: [
          '● Reservando a Morgan · 8 personas · 8:00 pm · mesas 4 + 5',
          '  ⎿  Plano de mesas actualizado · margen para clientes sin reserva movido a las 9:15 pm',
          '● Borrador de respuesta: “¡Feliz cumpleaños adelantado! Su mesa para 8 está lista el viernes a las 8:00 pm.',
          '  Tendremos una velita lista para el postre.”',
          '● Guardé 5 borradores de confirmación en outbox/reservations/; no se envió nada.',
          '● Listo: 5 confirmadas, 1 pendiente (Kim · 3 personas · sin hora).',
        ],
        2: [
          '● Apartando las 6:30 pm para Morgan · 8 personas · mesas 4 + 5',
          '  ⎿  Las 8:00 pm quedan libres para clientes sin reserva',
          '● Borrador de respuesta: “¡Nos encantaría festejar su cumpleaños! A las 8:00 pm ya no hay lugar, pero podemos',
          '  recibirlos a los 8 a las 6:30 pm, y el postre va por nuestra cuenta.”',
          '● Guardé 5 borradores de respuesta en outbox/reservations/; no se envió nada.',
          '● Listo: 4 confirmadas, 1 con propuesta de 6:30 pm, 1 pendiente (Kim · 3 personas).',
        ],
        3: [
          '● Agregando a Morgan · 8 personas · 8:00 pm a la lista de espera del viernes (lugar 1)',
          '● Borrador de respuesta: “El viernes a las 8:00 por ahora estamos llenos. Son los primeros en la lista de espera y',
          '  les llamamos al (555) 010-0123 en cuanto se libere una mesa grande.”',
          '● Guardé 5 borradores de respuesta en outbox/reservations/; no se envió nada.',
          '● Listo: 4 confirmadas, 1 en lista de espera, 1 pendiente (Kim · 3 personas).',
        ],
      },
      text: reply => [
        `● Sigo tu indicación para el grupo de Morgan: “${reply}”`,
        '● Reescribí la respuesta para Morgan con tu indicación, con el estilo del bistró.',
        '● Guardé 5 borradores de respuesta en outbox/reservations/; no se envió nada.',
        '● Listo: 4 confirmadas, Morgan respondido a tu manera, 1 pendiente (Kim · 3 personas).',
      ],
    },
    'w1:p2': {
      name: 'opiniones', title: 'Respuestas a reseñas de Google',
      task: 'Prepara respuestas a las reseñas de Google que llegaron desde el lunes.',
      spin: 'Redactando respuestas',
      work: [
        '● Leyendo reviews/new.txt',
        '  ⎿  5 reseñas nuevas · ★★★★★ ×3 · ★★★★ ×1 · ★★ ×1',
        '● Preparé respuestas para las 4 buenas:',
        '    ★★★★★ Alex P. — “la crema de almejas es la mejor de la ciudad” → gracias + crema de almejas',
        '    ★★★★★ Jamie W. — cena de aniversario → gracias + los esperamos el próximo año',
        '    ★★★★★ Chris D. — terraza que acepta perros → gracias + mención de los platos de agua',
        '    ★★★★  Robin S. — le encantó la comida, la música algo fuerte → gracias + tomamos nota',
        '● La reseña de 2 estrellas: “Esperamos 40 minutos los platos fuertes el sábado. La comida',
        '  estuvo buena, pero nadie nos dijo por qué.” — Taylor B.',
      ],
      ask: {
        question: '¿Cómo va la respuesta a la reseña de 2 estrellas de Taylor?',
        options: ['Disculparnos e invitar a Taylor a volver', 'Disculparnos y explicar que el sábado faltó personal', 'Dejársela al gerente'],
      },
      after: {
        1: [
          '● Borrador para Taylor B.:',
          '  “Taylor, lo sentimos: 40 minutos es demasiado y debimos avisarte.',
          '  Nos encantaría tener otra oportunidad. Llámanos al (555) 010-0123 y pregunta por Jo.”',
          '● Guardé 5 borradores en drafts/reviews-nov-12.md, en espera de tu aprobación.',
          '● Listo. No se publicó nada.',
        ],
        2: [
          '● Borrador para Taylor B.:',
          '  “Taylor, lamentamos la espera. El sábado dos de nuestros cocineros estaban enfermos',
          '  y debimos avisarle a cada mesa. Gracias por tu paciencia.”',
          '● Guardé 5 borradores en drafts/reviews-nov-12.md, en espera de tu aprobación.',
          '● Listo. No se publicó nada.',
        ],
        3: [
          '● Dejo a Taylor B. para el gerente, con una nota:',
          '  “2 estrellas, espera de 40 min el sábado. Sugiero una respuesta personal en menos de 24 horas.”',
          '● Guardé 4 borradores + 1 nota para el gerente en drafts/reviews-nov-12.md.',
          '● Listo. No se publicó nada.',
        ],
      },
      text: reply => [
        '● Borrador para Taylor B., con tus palabras:',
        `  “${reply}”`,
        '● Guardé 5 borradores en drafts/reviews-nov-12.md, en espera de tu aprobación.',
        '● Listo. No se publicó nada.',
      ],
    },
    'w1:p3': {
      name: 'menu-semanal', title: 'Publicación de especiales de la semana',
      task: 'Escribe la publicación de especiales de esta semana para Instagram y la página web.',
      spin: 'Escribiendo el texto',
      work: [
        '• Leyendo kitchen/specials-week-46.md',
        '  └ Halibut sellado · Risotto de calabaza · Crumble de manzana calientito',
        '• Borrador del texto (ES):',
        '  “Los viernes en Harbor Street: halibut sellado con mantequilla dorada, un risotto',
        '  que sabe a otoño y crumble de manzana recién salido del horno. Reserva tu mesa',
        '  en harborstreetbistro.example.com 🍂”',
        '• Actualicé el texto para la página web en drafts/specials.html',
        '• Encontré 3 fotos en photos/week-46/',
      ],
      ask: {
        question: '¿Qué foto va primero en la publicación?',
        options: ['halibut-plated.jpg (luminosa, vista desde arriba)', 'risotto-closeup.jpg (cálida, de cerca)', 'dining-room-evening.jpg (el salón)'],
      },
      after: {
        1: [
          '• Foto principal: halibut-plated.jpg · recorte 4:5 · texto alternativo listo',
          '• Guardé drafts/menu-post-week-46.md (texto, foto, hashtags)',
          '• Listo, en espera de tu aprobación. No se publicó nada.',
        ],
        2: [
          '• Foto principal: risotto-closeup.jpg · recorte 4:5 · texto alternativo listo',
          '• Ahora el texto empieza con el risotto: “Un risotto que sabe a otoño…”',
          '• Guardé drafts/menu-post-week-46.md (texto, foto, hashtags)',
          '• Listo, en espera de tu aprobación. No se publicó nada.',
        ],
        3: [
          '• Foto principal: dining-room-evening.jpg · recorte 4:5 · texto alternativo listo',
          '• Ahora el texto empieza con el salón: “Los viernes en Harbor Street…”',
          '• Guardé drafts/menu-post-week-46.md (texto, foto, hashtags)',
          '• Listo, en espera de tu aprobación. No se publicó nada.',
        ],
      },
      text: reply => [
        `• Anotado: “${reply}”`,
        '• Ajusté el texto y la foto para que coincidan.',
        '• Guardé drafts/menu-post-week-46.md, en espera de tu aprobación.',
      ],
    },
    'w1:p4': {
      name: 'pedidos', title: 'Pedido de verduras del jueves',
      task: 'Arma el pedido de verduras y lácteos del jueves con el conteo de inventario de esta noche.',
      spin: 'Comparando el inventario con los mínimos',
      work: [
        '● Leyendo stock/count-nov-11.csv',
        '  ⎿  42 productos contados · 9 por debajo del mínimo',
        '● Por debajo del mínimo: limones, crema para batir, chalotes, tomillo, mantequilla, huevo, arúgula,',
        '  calabaza, halibut (faltan 6 kg)',
        '● Revisando la lista de precios de esta semana de Green Valley Produce',
        '  ⎿  Cierre de pedidos el miércoles a las 2:00 pm · 3 precios cambiaron',
        '● El halibut subió 18% esta semana: $54.00/kg (antes $45.75).',
        '  Hay bacalao a $30.90/kg.',
      ],
      ask: {
        question: 'El halibut subió 18% esta semana. ¿Qué pido?',
        options: ['6 kg de halibut, como siempre', '4 kg de halibut y terminar antes el especial', 'Cambiar a bacalao esta semana'],
      },
      after: {
        1: [
          '● Pedido: 9 productos, halibut 6 kg · total estimado $1,486.20',
          '● Guardé orders/thursday-order.csv y un borrador de correo para',
          '  orders@greenvalley.example.com; no se envió.',
          '● Listo. Costo de alimentos de esta semana: 31.8% (meta: 30%).',
        ],
        2: [
          '● Pedido: 9 productos, halibut 4 kg · total estimado $1,262.40',
          '● Nota para cocina: “El especial de halibut termina el sábado o cuando se acabe.”',
          '● Guardé orders/thursday-order.csv y un borrador de correo para',
          '  orders@greenvalley.example.com; no se envió.',
          '● Listo. Costo de alimentos de esta semana: 30.6% (meta: 30%).',
        ],
        3: [
          '● Pedido: 9 productos, bacalao 6 kg en lugar de halibut · total estimado $1,104.70',
          '● Aviso para menu-semanal: el especial cambia a bacalao sellado.',
          '● Guardé orders/thursday-order.csv y un borrador de correo para',
          '  orders@greenvalley.example.com; no se envió.',
          '● Listo. Costo de alimentos de esta semana: 29.4% (meta: 30%).',
        ],
      },
      text: reply => [
        `● Va como dijiste: “${reply}”`,
        '● Guardé orders/thursday-order.csv y un borrador de correo para',
        '  orders@greenvalley.example.com; no se envió.',
        '● Listo.',
      ],
    },

    // ── Brightside Dental ─────────────────────────────────────────────────────
    'w2:p1': {
      name: 'recordatorios', title: 'Recordatorios de mañana',
      task: 'Prepara los recordatorios de las citas de mañana.',
      spin: 'Redactando recordatorios',
      work: [
        '● Leyendo schedule/2026-11-13.csv',
        '  ⎿  23 citas · 2 dentistas · 2 higienistas',
        '● Preparé 21 recordatorios (mensaje + correo), cada uno con la hora, el dentista y',
        '  “Responde C para confirmar o llama al (555) 010-0188 para cambiar tu cita.”',
        '● 1 paciente no tiene teléfono registrado → solo correo (r.alvarez@example.com)',
        '● Jordan M. pidió la semana pasada cambiarse a la tarde. Su cita de mañana a las 9:00 am',
        '  sigue en la agenda, y las 2:30 pm con el Dr. Chen están libres.',
      ],
      ask: {
        question: '¿Qué debe decir el recordatorio de Jordan?',
        options: ['Dejar las 9:00 am como está', 'Ofrecer el horario libre de las 2:30 pm', 'Omitirlo y marcarlo para una llamada'],
      },
      after: {
        1: [
          '● Jordan M.: recordatorio normal para las 9:00 am con el Dr. Chen',
          '● Guardé 23 borradores de recordatorio en reminders/2026-11-13/; no se envió nada.',
          '● Listo.',
        ],
        2: [
          '● Jordan M.: “Nos pediste una cita por la tarde: podemos cambiarte a las',
          '  2:30 pm de mañana con el Dr. Chen. Responde SÍ para cambiarla o quédate con las 9:00 am.”',
          '● Aparté las 2:30 pm para Jordan hasta las 6:00 pm de hoy.',
          '● Guardé 23 borradores de recordatorio en reminders/2026-11-13/; no se envió nada.',
          '● Listo.',
        ],
        3: [
          '● Jordan M.: sin recordatorio. Lo agregué a la lista de llamadas de recepción con la nota',
          '  “Pidió una cita por la tarde. Las 2:30 pm con el Dr. Chen están libres.”',
          '● Guardé 22 borradores de recordatorio en reminders/2026-11-13/; no se envió nada.',
          '● Listo.',
        ],
      },
      text: reply => [
        `● Ahora el recordatorio de Jordan M. dice: “${reply}”`,
        '● Guardé 23 borradores de recordatorio en reminders/2026-11-13/; no se envió nada.',
        '● Listo.',
      ],
    },
    'w2:p2': {
      name: 'opiniones', title: 'Respuestas a reseñas',
      task: 'Prepara respuestas a las reseñas de Google de esta semana.',
      spin: 'Redactando respuestas',
      work: [
        '● Leyendo reviews/week-46.txt',
        '  ⎿  4 reseñas nuevas · ★★★★★ ×3 · ★★ ×1',
        '● Preparé 3 respuestas de agradecimiento (solo nombre de pila, sin detalles del tratamiento).',
        '● La reseña de 2 estrellas: “La limpieza estuvo muy bien, pero me llegó una cuenta que no',
        '  esperaba. Nadie me explicó qué cubría el seguro.” — Morgan T.',
      ],
      ask: {
        question: '¿Cómo respondo a la reseña de Morgan sobre el cobro?',
        options: ['Disculparnos y ofrecer una llamada con la administradora', 'Agradecer y explicar cómo funcionan los presupuestos', 'Dejársela a la administradora'],
      },
      after: {
        1: [
          '● Borrador para Morgan T.:',
          '  “Morgan, lamentamos que la cuenta te tomara por sorpresa. Nuestra administradora quiere',
          '  explicártela: llámanos al (555) 010-0147 cuando te acomode.”',
          '● Guardé 4 borradores en drafts/reviews-week-46.md, en espera de tu aprobación.',
          '● Listo. No se publicó nada.',
        ],
        2: [
          '● Borrador para Morgan T.:',
          '  “Gracias, Morgan. Antes de cada visita podemos enviarte un presupuesto por escrito con lo que',
          '  cubre tu seguro: solo pídelo en recepción o llama al (555) 010-0147.”',
          '● Guardé 4 borradores en drafts/reviews-week-46.md, en espera de tu aprobación.',
          '● Listo. No se publicó nada.',
        ],
        3: [
          '● Dejo a Morgan T. para la administradora, con una nota:',
          '  “Cobro inesperado después de una limpieza. Responder primero en privado y luego en público.”',
          '● Guardé 3 borradores + 1 nota en drafts/reviews-week-46.md.',
          '● Listo. No se publicó nada.',
        ],
      },
      text: reply => [
        '● Borrador para Morgan T., con tus palabras:',
        `  “${reply}”`,
        '● Guardé 4 borradores en drafts/reviews-week-46.md, en espera de tu aprobación.',
        '● Listo. No se publicó nada.',
      ],
    },
    'w2:p3': {
      name: 'fichas', title: 'Revisión de fichas de pacientes nuevos',
      task: 'Revisa las fichas de los pacientes nuevos de esta semana antes de su primera visita.',
      spin: 'Revisando fichas',
      work: [
        '• Leyendo intake/week-46/',
        '  └ 7 fichas',
        '• 5 completas ✓',
        '• Riley S.: falta el número de afiliado del seguro → agregado a la lista de recepción',
        '• Casey L.: indica alergia a la penicilina, pero la lista de medicamentos está vacía.',
      ],
      ask: {
        question: '¿Qué hago con la ficha de Casey L.?',
        options: ['Marcarla para la higienista al registrarse', 'Preparar un correo para que Casey confirme', 'Las dos cosas'],
      },
      after: {
        1: [
          '• Agregué un aviso de registro para Casey L. (alergia: penicilina · confirmar medicamentos)',
          '• Reporte guardado en reports/intake-week-46.md',
          '• Listo.',
        ],
        2: [
          '• Borrador de correo a casey.l@example.com: “¿Nos confirmas qué medicamentos',
          '  tomas? Puedes responder aquí o llamar al (555) 010-0188.” No se envió.',
          '• Reporte guardado en reports/intake-week-46.md',
          '• Listo.',
        ],
        3: [
          '• Agregué un aviso de registro para Casey L. (alergia: penicilina · confirmar medicamentos)',
          '• Borrador de correo a casey.l@example.com para confirmar medicamentos; no se envió.',
          '• Reporte guardado en reports/intake-week-46.md',
          '• Listo.',
        ],
      },
      text: reply => [
        `• Anotado para Casey L.: “${reply}”`,
        '• Reporte guardado en reports/intake-week-46.md',
        '• Listo.',
      ],
    },
    'w2:p4': {
      name: 'limpiezas', title: 'Pacientes con limpieza pendiente',
      task: 'Encuentra a los pacientes que ya pasaron su limpieza de cada 6 meses y prepara mensajes para invitarlos a volver.',
      spin: 'Ordenando la lista de pendientes',
      work: [
        '● Leyendo patients/active.csv y hygiene/visits.csv',
        '  ⎿  1,240 pacientes activos',
        '● 86 tienen su limpieza atrasada:',
        '    55 con 6 a 12 meses de atraso · 31 con más de 12 meses',
        '● 44 horarios de higiene libres este mes (mar–sáb)',
        '● Preparé un mensaje amable con enlace para agendar',
        '  (brightsidedental.example.com/book) y el teléfono del consultorio (555) 010-0188.',
      ],
      ask: {
        question: '¿Cómo reparto los 86 mensajes?',
        options: ['30 al día, a partir del lunes', 'Primero los 31 más atrasados', 'Solo tantos como horarios libres (44)'],
      },
      after: {
        1: [
          '● 3 tandas: lun 30 · mar 30 · mié 26',
          '● Guardé recall/drafts-week-47/ (86 borradores); no se envió nada.',
          '● Listo.',
        ],
        2: [
          '● Tanda 1: los 31 pacientes con más de 12 meses de atraso',
          '● La tanda 2 (55) espera a que la tanda 1 agende.',
          '● Guardé recall/drafts-week-47/ (31 borradores); no se envió nada.',
          '● Listo.',
        ],
        3: [
          '● 44 borradores, los más atrasados primero, según los horarios libres',
          '● Guardé recall/drafts-week-47/ (44 borradores); no se envió nada.',
          '● Listo. 42 pacientes esperan la agenda del próximo mes.',
        ],
      },
      text: reply => [
        `● Los reparto como dijiste: “${reply}”`,
        '● Guardé recall/drafts-week-47/; no se envió nada.',
        '● Listo.',
      ],
    },
  },

  // Routine prompts shown in the Routines tab (the three shipped packs and the demo's own).
  prompts: {
    'review-reply-desk': 'Preparas respuestas a las reseñas de clientes de un negocio pequeño. Nunca publicas nada.\n\nEntrada: ~/free-orca-desk/reviews. Cada archivo .txt tiene una o más reseñas copiadas del perfil de Google del negocio (nombre, estrellas, fecha, texto). Si existe ~/free-orca-desk/reviews/replied.txt, lista las reseñas que ya tienen respuesta: sáltalas. Si la carpeta no existe o está vacía, créala y explica en el borrador, en español y en inglés, qué poner ahí.\n\nPara cada reseña sin respuesta, escribe un borrador:\n- en el idioma de quien la escribió (español o inglés);\n- de 2 a 4 frases, cálido y específico sobre lo que escribió, firmado por el negocio;\n- 4-5 estrellas: agradece y menciona el detalle que le gustó;\n- 1-3 estrellas: discúlpate sin discutir, nunca admitas culpa legal, ofrece seguir en privado y deja un espacio [TELÉFONO o WHATSAPP] para que el dueño lo llene;\n- nunca prometas descuentos ni reembolsos, ni incluyas datos personales más allá del nombre de pila.\n\nFormato de cada una: nombre, estrellas, la reseña (una línea) y luego el borrador. Pon primero las de 1-3 estrellas.',
    'morning-front-desk-brief': 'Preparas el resumen matutino del dueño de un negocio pequeño.\n\nEntrada: la carpeta ~/free-orca-desk/inbox. Ahí el dueño deja exportaciones: chats de WhatsApp (.txt), una lista de reservas o citas (.csv), reseñas de Google copiadas (.txt) y una lista de pagos o facturas (.csv). Lee solo los archivos que cambiaron en los últimos 2 días. Si la carpeta no existe o está vacía, créala y escribe un resumen corto que explique, en español y en inglés, qué archivos dejar ahí.\n\nEscribe un resumen de una página con estas secciones, cada una con 5 puntos como máximo, lo más urgente primero:\n1. Hay que responder hoy (quién, qué pidió, cuánto lleva esperando)\n2. Reservas de hoy y cualquier cosa fuera de lo normal\n3. Reseñas nuevas (estrellas, resumen de una línea)\n4. Pagos atrasados (cliente, monto, días de atraso)\n5. Las tres primeras cosas por hacer\n\nEscríbelo en el idioma de la mayoría de los mensajes (español o inglés). Nunca inventes datos: si una sección no tiene nada, dilo. Solo lectura: no cambies, muevas ni borres ningún archivo de entrada.',
    'competitor-local-watch': 'Escribes una nota semanal del mercado local para un negocio pequeño, solo con información pública.\n\nEntrada: ~/free-orca-desk/business.txt describe el negocio (nombre, giro, ciudad o colonia, sitio web) y puede listar competidores conocidos. Si el archivo no existe, créalo con una plantilla corta (en español y en inglés) para que el dueño la llene, y termina con una nota que lo diga.\n\nSolo con búsquedas públicas en internet (sin iniciar sesión, sin formularios, sin contactar a nadie), busca:\n1. Negocios nuevos del mismo giro cerca, en el último mes\n2. Promociones visibles, cambios de precio o servicios nuevos de la competencia\n3. Cambios en las calificaciones públicas o en el número de reseñas de la competencia, si se ven\n4. Eventos locales o cambios de temporada en las próximas 2 semanas que puedan afectar la demanda\n\nQue quepa en una página. Da el enlace de la fuente de cada dato y marca como no confirmado lo que no sea seguro. Termina con 3 ideas prácticas que el dueño pueda aplicar esta semana. Escribe en el idioma de business.txt.',
    'reservation-confirmations': 'Lee las solicitudes de reserva en ~/harbor-street-bistro/inbox/reservations y el plano de mesas. Prepara una confirmación corta y cálida, o una alternativa, para cada solicitud. Nunca envíes nada.',
    'weekend-prep-list': 'Compara el pronóstico de comensales del fin de semana con el conteo de inventario en ~/harbor-street-bistro/stock y escribe una lista de preparación por estación. Solo reporte.',
    'reminder-drafts': 'Lee la agenda de mañana en ~/brightside-dental/schedule y prepara un recordatorio por cita (hora, dentista, cómo confirmar). Sin detalles del tratamiento. Nunca envíes nada.',
    'recall-list': 'Lista a los pacientes con su limpieza de 6 meses atrasada a partir de ~/brightside-dental/patients y prepara mensajes para invitarlos a volver, en tandas. Nunca envíes nada.',
  },

  drafts: {
    'review-reply-desk@harbor-street-bistro': `# Respuestas a reseñas — Harbor Street Bistro

**Responder primero (1–3 estrellas)**

**Taylor B. · ★★ · 8 nov**
> Esperamos 40 minutos los platos fuertes el sábado. La comida estuvo buena, pero nadie nos dijo por qué.

Borrador: Taylor, lo sentimos: 40 minutos es demasiado y debimos avisarte mientras esperabas.
Nos encantaría tener otra oportunidad: búscanos en [TELÉFONO o WHATSAPP].
— Harbor Street Bistro

**Alex P. · ★★★★★ · 9 nov**
> La crema de almejas es la mejor de la ciudad.

Borrador: ¡Gracias, Alex! La receta de la crema de almejas no ha cambiado en años y nos da
gusto que te siga encantando. Te esperamos pronto. — Harbor Street Bistro

**Robin S. · ★★★★ · 10 nov**
> Me encantó la comida, la música estaba un poco fuerte.

Borrador: ¡Gracias, Robin! Qué bueno que disfrutaste la cena, y gracias por el comentario sobre
la música: ya la bajamos para el servicio de la cena. — Harbor Street Bistro
`,
    'reservation-confirmations@harbor-street-bistro': `# Confirmación de reservas — viernes

- Dana R. · 2 personas · 7:00 pm · "¡Los esperamos el viernes a las 7! Su mesa junto a la ventana está lista."
- Priya N. · 4 personas · 7:30 pm · "Todo listo para 4 personas a las 7:30 pm."
- Familia Lee · 5 personas · 6:15 pm · "Tendremos lista una silla para bebé."
`,
    'morning-front-desk-brief@harbor-street-bistro': `# Resumen matutino — Harbor Street Bistro

- 64 comensales reservados para esta noche (vie). Terraza cerrada: pronóstico de 9 °C.
- 2 mensajes de voz: la hora de entrega de un proveedor y un cliente que pregunta por opciones sin gluten.
- 3 reseñas nuevas en Google (promedio 4.3).
- Antes de las 4 pm: confirmar el grupo de 8 (Morgan, 8:00 pm).
`,
    'weekend-prep-list@harbor-street-bistro': `# Lista de preparación del fin de semana

- Parrilla: 22 porciones de halibut, 40 porciones de corte
- Salteado: 6 L de base para risotto, 3 L de mantequilla dorada
- Repostería: 4 charolas de crumble de manzana
`,
    'reminder-drafts@brightside-dental': `# Recordatorios de citas — mañana

1. Avery K. · 8:00 am · Dr. Chen — "Hola, Avery: te recordamos tu cita de mañana a las 8:00 am con
   el Dr. Chen en Brightside Dental. Responde C para confirmar o llama al (555) 010-0188 para cambiarla."
2. Jordan M. · 9:00 am · Dr. Chen — "Hola, Jordan: nos pediste una cita por la tarde y podemos
   cambiarte a las 2:30 pm de mañana. Responde SÍ para cambiarla o C para quedarte con las 9:00 am."
3. Quinn W. · 10:30 am · higiene — "Hola, Quinn: te esperamos mañana a las 10:30 am para tu limpieza.
   Responde C para confirmar."

Siguen 21 recordatorios más con el mismo formato. No se ha enviado nada.
`,
    'review-reply-desk@brightside-dental': `# Respuestas a reseñas — Brightside Dental

**Lee H. · ★★★★★**
Borrador: ¡Gracias, Lee! Nos da mucho gusto que tu visita haya sido tranquila. Te esperamos en tu próxima limpieza.
— Brightside Dental
`,
    'competitor-local-watch@brightside-dental': `# Vigilancia local — semana 45

- Dos consultorios cercanos ya anuncian horario los sábados; los horarios de sábado de Brightside se llenan primero.
- Calificación promedio en la zona: 4.5. Brightside: 4.8 (212 reseñas).
`,
    'recall-list@brightside-dental': `# Lista de limpiezas pendientes

86 pacientes con limpieza atrasada. Tanda 1 (31, con más de 12 meses de atraso) preparada.
`,
  },
};

module.exports = { ES };
