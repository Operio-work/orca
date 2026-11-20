// Terms and Privacy for ORCA: the free open-source panel and this website, and ORCA Managed by
// Operio (the hosted panel). They sit next to Operio's own Terms and Privacy Policy at
// operio.work, which name the responsible company and the ARCO process; these pages add what is
// specific to ORCA, including how Operio processes a client's data in a hosted panel.
// Bodies are HTML strings rendered with {@html}: keep markup to <p>, <ul>, <li>, <strong>, <a>, <em>.
// Never put hosting internals here (hosts, IPs, paths): name providers by category and country.

const UPDATED = { en: 'Last updated: November 19, 2026', es: 'Última actualización: 19 de noviembre de 2026' };

export const legal = {
  en: {
    eyebrow: 'Legal',
    nav: { terms: 'Terms', privacy: 'Privacy' },
    terms: {
      title: 'ORCA Terms',
      metaTitle: 'ORCA Terms: free ORCA and ORCA Managed by Operio',
      description: 'The terms for the free, open-source ORCA panel and for ORCA Managed by Operio: plans and billing, model accounts, approvals, your data, ending the service, and how Operio processes your data.',
      updated: UPDATED.en,
      intro: `<p>These terms cover <strong>ORCA</strong>, made by Operio: the free, open-source panel and this website (make.operio.work), and <strong>ORCA Managed by Operio</strong>, the same panel on a server Operio runs for you. For ORCA Managed, Operio's general <a href="https://operio.work/terms">Terms of Service</a> also apply; where they differ, these terms decide for ORCA.</p>`,
      sections: [
        { heading: 'Part A · Free ORCA', part: true },
        { heading: '1. The software', html: `<p>ORCA is open source under the <a href="https://github.com/operio-work/orca/blob/main/LICENSE">MIT license</a>. It is provided as is, without warranty, as that license says. It runs on your own computer and is yours to use, change and share under the license.</p>
<p>You decide which agents run, which accounts and keys they use, and what they may do on your computer. The agent tools ORCA starts (such as Claude Code, Codex, Gemini CLI or opencode) and the model providers behind them have their own terms, which you accept with them.</p>` },
        { heading: '2. This website and the installer', html: `<p>You don't need an account to read this site or install ORCA. The installer downloads one pinned release and checks its fingerprint before installing it. Updates come from this site or from GitHub when you run <code>operio-orca update</code>.</p>` },

        { heading: 'Part B · ORCA Managed by Operio', part: true },
        { heading: '3. The service', html: `<p>Operio runs your ORCA panel on a server it manages, behind a sign-in. Operio sets up your model access, your first saved agents, the tools they connect to and the routines you pick, and keeps the panel updated, monitored and backed up.</p>` },
        { heading: '4. Plans, prices and billing', html: `<p>ORCA Managed comes with an Operio plan: Light, Starter, Pro or Automation Hub. Prices are listed on the <a href="/managed#pricing">ORCA Managed page</a> and at <a href="https://operio.work/pricing">operio.work/pricing</a>. Each plan has a monthly fee and a one-time onboarding fee. Prices on the English pages are in US dollars; prices on the Spanish pages are in Mexican pesos, IVA included.</p>
<ul>
<li>Launch prices are shown next to the standard price and may end. Any price change is announced at least 30 days before it applies to you.</li>
<li>The monthly fee is billed in advance. Onboarding is billed once, before setup starts.</li>
<li>Fees are non-refundable except where the law requires otherwise.</li>
<li>If a payment fails, Operio tries again and tells you. A panel with an unpaid balance may be suspended after 7 days and closed after 30 days (section 11 applies).</li>
</ul>` },
        { heading: '5. Model accounts', html: `<p>Your agents run on your own model subscription or API key, which Operio sets up for you. The model provider bills you directly, and its terms and limits apply. If you don't have an account, Operio arranges one with you and tells you the cost before anything is charged.</p>` },
        { heading: '6. Your team and sign-in', html: `<p>You decide who on your team gets access and with which role. Admins run the agents; viewers follow along and comment. Keep sign-ins to yourselves and tell us at <a href="mailto:support@operio.work">support@operio.work</a> if you think someone else has used one.</p>` },
        { heading: '7. Approvals and agent work', html: `<p>Agents can make mistakes. Drafts, replies and anything an agent prepares should be checked before they reach a customer, and ORCA lets you require your approval first. Once you or your team approve something, or set a routine to send without approval, you are responsible for what is sent. Operio is not liable for losses from agent output used without human review.</p>` },
        { heading: '8. Acceptable use', html: `<p>Use ORCA Managed only for lawful purposes. Don't use it to send spam or messages people didn't ask for; to harass anyone; to collect personal data in bulk from websites; to open websites against their terms; to upload malicious code; to try to reach other clients' data or Operio's systems; or to resell access without Operio's written permission.</p>` },
        { heading: '9. Your data', html: `<p>Your documents, conversations, journal, routines and settings stay yours. Operio uses them only to run your panel for you, never to train AI models, and never sells or shares them for anyone else's purposes. Part C explains how Operio handles them.</p>` },
        { heading: '10. Availability, updates and backups', html: `<p>Operio aims for 99.5% availability each month but does not guarantee uninterrupted service. Planned maintenance is announced in advance when possible. Operio applies ORCA updates for you and keeps regular backups of your panel's data. Operio is not liable for outages caused by model providers, connected services or events outside its control.</p>` },
        { heading: '11. Ending the service', html: `<p>You can cancel at any time; the cancellation takes effect at the end of the period you have paid for. Before your panel closes, you can ask for a copy of your data (saved agents, routines, journal, knowledge documents and team chat) and move to free ORCA on your own computer. After closing, Operio keeps your data for 30 days so it can be recovered, then deletes it, including from backups as they cycle out.</p>
<p>Operio may suspend a panel at once if these terms are broken, if it puts other clients or Operio's systems at risk, or if the law requires it.</p>` },
        { heading: '12. Liability', html: `<p>To the extent the law allows, Operio is not liable for indirect, incidental or consequential damages, including lost profits, data or opportunities. Operio's total liability for any claim is limited to the fees you paid for ORCA Managed in the 3 months before the event that gave rise to it.</p>` },
        { heading: '13. Changes to these terms', html: `<p>Operio may update these terms. The current version is always on this page with its date. Material changes are announced by email or in the panel at least 14 days before they take effect.</p>` },
        { heading: '14. Governing law', html: `<p>These terms are governed by the laws of the jurisdiction where Operio is registered, as set out in Operio's <a href="https://operio.work/terms">Terms of Service</a>.</p>` },

        { heading: 'Part C · How Operio processes your data in ORCA Managed', part: true },
        { heading: '15. Roles', html: `<p>For the personal data in your panel (your team's, and your customers' in conversations, documents and drafts), you are the controller (<em>responsable</em>) and Operio processes it for you as a processor (<em>encargado</em>), only to run your panel. These commitments apply on top of Operio's <a href="https://operio.work/privacy">Privacy Policy</a>.</p>` },
        { heading: '16. Operio’s commitments', html: `<ul>
<li><strong>Your instructions only.</strong> Operio processes your data as these terms and your panel settings say, and for nothing else.</li>
<li><strong>Need to know.</strong> Only the Operio staff who run your panel have access, under confidentiality, and only to operate it or to help when you ask. Operio staff can read your team chat only when your admin turns that on.</li>
<li><strong>Security.</strong> Each client's panel runs separately on the server, behind a sign-in, with encrypted connections. Keys and secrets are stored readable only by your panel and are never shown again in full. The service is monitored.</li>
<li><strong>Providers.</strong> Operio uses a cloud hosting provider (servers in the United States), a DNS and network security provider, the model provider you choose (under your own account) and, only if you turn it on, a web page reading service. They process data under Operio's instructions. The current list is available at <a href="mailto:privacy@operio.work">privacy@operio.work</a>, and you are told before a new provider is added.</li>
<li><strong>Incidents.</strong> If a security incident affects your data, Operio tells you without undue delay, and within 72 hours of confirming it, with what is known and what is being done.</li>
<li><strong>Your requests.</strong> Operio helps you answer requests from people exercising their rights over data in your panel.</li>
<li><strong>At the end.</strong> Operio returns your data on request and deletes it as section 11 says.</li>
<li><strong>Information.</strong> On request, Operio gives you the information you reasonably need to show these commitments are met.</li>
</ul>` },
      ],
      contactHeading: '17. Contact',
      contactHtml: `<p>Questions about these terms: <a href="mailto:legal@operio.work">legal@operio.work</a>. About your data: <a href="mailto:privacy@operio.work">privacy@operio.work</a>.</p>`,
    },
    privacy: {
      title: 'ORCA Privacy',
      metaTitle: 'ORCA Privacy: this website, free ORCA and ORCA Managed',
      description: 'What data this website, the free ORCA panel and ORCA Managed by Operio handle, where it is kept, who else processes it, and your rights.',
      updated: UPDATED.en,
      intro: `<p>This notice explains what data ORCA handles: on this website, in the free panel on your own computer, and in ORCA Managed by Operio. It adds to Operio's <a href="https://operio.work/privacy">Privacy Policy</a>, which names the company responsible for your data, its address, and how to exercise your rights (ARCO) under Mexico's data protection law.</p>`,
      sections: [
        { heading: '1. This website', html: `<ul>
<li>No account, no sign-in, no advertising, no analytics and no tracking cookies.</li>
<li>Your theme choice (light or dark) is kept in your own browser and never sent to us.</li>
<li>Like any web server, ours records each request (IP address, page, browser and time) for security and troubleshooting, and keeps these records for a short time.</li>
<li>Links to Operio's other sites, to GitHub and to the booking page go to services with their own privacy notices.</li>
</ul>` },
        { heading: '2. Free ORCA on your computer', html: `<p>The free panel runs on your own computer and sends nothing to Operio: no telemetry, no usage reports. Your agents, documents, journal and keys stay on your computer. When you install or update, your computer downloads ORCA from this site or from GitHub, which, like any download, reveals your IP address to that server.</p>
<p>The agents you run send your prompts and files to the model providers you choose, under those providers' own policies. If you turn on the web browser, pages are opened from your own computer.</p>` },
        { heading: '3. ORCA Managed: what Operio keeps', html: `<ul>
<li><strong>Your team:</strong> names, sign-in emails and roles.</li>
<li><strong>Your panel's work:</strong> agent sessions and replies, team chat, the journal, routines and their drafts, saved agents, templates and the knowledge documents you upload.</li>
<li><strong>Settings and secrets:</strong> tool settings and the keys your agents use, stored readable only by your panel.</li>
<li><strong>Service records:</strong> sign-ins, errors and usage needed to run, secure and bill the service.</li>
</ul>` },
        { heading: '4. Why', html: `<p>To run your panel and your agents, to support you, to keep the service secure, to bill you, and to meet legal duties. Operio does not use your data to train AI models, does not sell it, and does not use it for advertising.</p>` },
        { heading: '5. Where, and who else', html: `<p>Your panel runs on servers in the United States. Operio uses a cloud hosting provider, a DNS and network security provider, the model provider you choose (under your own account) and, only if you turn it on, a web page reading service. They process data for Operio, under its instructions. The current list is available at <a href="mailto:privacy@operio.work">privacy@operio.work</a>.</p>` },
        { heading: '6. Who at Operio can see it', html: `<p>Only the staff who run your panel, under confidentiality, when they need to operate it or when you ask for help. Your team chat is visible to Operio staff only when your admin turns that on.</p>` },
        { heading: '7. How long', html: `<p>While your panel is active. After it closes, Operio keeps your data for 30 days so it can be recovered, then deletes it, including from backups as they cycle out. You can ask for a copy before closing, or for deletion sooner.</p>` },
        { heading: '8. Your rights', html: `<p>You can ask to access, correct or delete your personal data, or object to its use, as Operio's <a href="https://operio.work/privacy">Privacy Policy</a> explains, by writing to <a href="mailto:privacy@operio.work">privacy@operio.work</a>. For your customers' data inside your panel, your business decides, and Operio helps you answer their requests.</p>` },
        { heading: '9. Changes', html: `<p>The current version is always on this page with its date. Significant changes are announced by email or in the panel at least 14 days before they take effect.</p>` },
      ],
      contactHeading: '10. Contact',
      contactHtml: `<p><a href="mailto:privacy@operio.work">privacy@operio.work</a></p>`,
    },
  },

  es: {
    eyebrow: 'Legal',
    nav: { terms: 'Términos', privacy: 'Privacidad' },
    terms: {
      title: 'Términos de ORCA',
      metaTitle: 'Términos de ORCA: ORCA gratis y ORCA Gestionado por Operio',
      description: 'Los términos del panel ORCA gratuito y de código abierto y de ORCA Gestionado por Operio: planes y cobro, cuentas de modelos, aprobaciones, tus datos, fin del servicio y cómo Operio trata tus datos.',
      updated: UPDATED.es,
      intro: `<p>Estos términos cubren <strong>ORCA</strong>, hecho por Operio: el panel gratuito y de código abierto y este sitio (make.operio.work), y <strong>ORCA Gestionado por Operio</strong>, el mismo panel en un servidor que Operio administra por ti. Para ORCA Gestionado también aplican los <a href="https://operio.work/es/terms">Términos de servicio</a> generales de Operio; donde sean distintos, estos términos deciden para ORCA.</p>`,
      sections: [
        { heading: 'Parte A · ORCA gratis', part: true },
        { heading: '1. El software', html: `<p>ORCA es de código abierto bajo la <a href="https://github.com/operio-work/orca/blob/main/LICENSE">licencia MIT</a>. Se entrega tal cual, sin garantía, como dice esa licencia. Corre en tu propia computadora y puedes usarlo, cambiarlo y compartirlo según la licencia.</p>
<p>Tú decides qué agentes corren, qué cuentas y claves usan y qué pueden hacer en tu computadora. Las herramientas de agentes que ORCA abre (como Claude Code, Codex, Gemini CLI u opencode) y los proveedores de modelos detrás de ellas tienen sus propios términos, que aceptas con ellas.</p>` },
        { heading: '2. Este sitio y el instalador', html: `<p>No necesitas cuenta para leer este sitio ni para instalar ORCA. El instalador descarga una versión fija y revisa su huella antes de instalarla. Las actualizaciones vienen de este sitio o de GitHub cuando ejecutas <code>operio-orca update</code>.</p>` },

        { heading: 'Parte B · ORCA Gestionado por Operio', part: true },
        { heading: '3. El servicio', html: `<p>Operio corre tu panel de ORCA en un servidor que administra, detrás de un inicio de sesión. Operio configura el acceso a tus modelos, tus primeros agentes guardados, las herramientas a las que se conectan y las rutinas que elijas, y mantiene el panel actualizado, vigilado y respaldado.</p>` },
        { heading: '4. Planes, precios y cobro', html: `<p>ORCA Gestionado viene con un plan de Operio: Light, Starter, Pro o Automation Hub. Los precios están en la <a href="/es/managed#pricing">página de ORCA Gestionado</a> y en <a href="https://operio.work/es/pricing">operio.work/es/pricing</a>. Cada plan tiene una mensualidad y un pago único de onboarding. En las páginas en español los precios están en pesos mexicanos, IVA incluido; en las páginas en inglés, en dólares estadounidenses.</p>
<ul>
<li>Los precios de lanzamiento se muestran junto al precio normal y pueden terminar. Cualquier cambio de precio se avisa al menos 30 días antes de que te aplique.</li>
<li>La mensualidad se cobra por adelantado. El onboarding se cobra una vez, antes de empezar la configuración.</li>
<li>Los pagos no son reembolsables, salvo donde la ley diga otra cosa.</li>
<li>Si un pago falla, Operio lo intenta de nuevo y te avisa. Un panel con saldo pendiente puede suspenderse a los 7 días y cerrarse a los 30 (aplica la sección 11).</li>
</ul>` },
        { heading: '5. Cuentas de modelos', html: `<p>Tus agentes corren con tu propia suscripción o clave de API del modelo, que Operio configura por ti. El proveedor del modelo te cobra directamente y aplican sus términos y límites. Si no tienes cuenta, Operio la consigue contigo y te dice el costo antes de cualquier cargo.</p>` },
        { heading: '6. Tu equipo y el acceso', html: `<p>Tú decides quién de tu equipo entra y con qué rol. Los administradores manejan los agentes; los observadores siguen el trabajo y comentan. No compartan sus accesos y avísanos en <a href="mailto:support@operio.work">support@operio.work</a> si crees que alguien más usó uno.</p>` },
        { heading: '7. Aprobaciones y trabajo de los agentes', html: `<p>Los agentes pueden equivocarse. Los borradores, respuestas y todo lo que prepara un agente deben revisarse antes de llegar a un cliente, y ORCA te permite exigir tu aprobación primero. Cuando tú o tu equipo aprueban algo, o configuran una rutina para enviar sin aprobación, lo que se envía es tu responsabilidad. Operio no responde por pérdidas por usar el trabajo de un agente sin revisión humana.</p>` },
        { heading: '8. Uso aceptable', html: `<p>Usa ORCA Gestionado solo para fines legales. No lo uses para enviar spam o mensajes no solicitados; para acosar a nadie; para juntar datos personales en masa de sitios web; para abrir sitios en contra de sus términos; para subir código malicioso; para intentar llegar a los datos de otros clientes o a los sistemas de Operio; ni para revender el acceso sin permiso por escrito de Operio.</p>` },
        { heading: '9. Tus datos', html: `<p>Tus documentos, conversaciones, bitácora, rutinas y ajustes siguen siendo tuyos. Operio los usa solo para correr tu panel, nunca para entrenar modelos de IA, y nunca los vende ni los comparte para fines de otros. La parte C explica cómo los trata Operio.</p>` },
        { heading: '10. Disponibilidad, actualizaciones y respaldos', html: `<p>Operio busca una disponibilidad del 99.5% cada mes, pero no garantiza un servicio sin interrupciones. El mantenimiento planeado se avisa con anticipación cuando es posible. Operio aplica las actualizaciones de ORCA por ti y guarda respaldos periódicos de los datos de tu panel. Operio no responde por caídas causadas por los proveedores de modelos, los servicios conectados o hechos fuera de su control.</p>` },
        { heading: '11. Fin del servicio', html: `<p>Puedes cancelar cuando quieras; la cancelación aplica al final del periodo que ya pagaste. Antes de que tu panel cierre, puedes pedir una copia de tus datos (agentes guardados, rutinas, bitácora, documentos de conocimiento y chat del equipo) y pasarte a ORCA gratis en tu propia computadora. Después del cierre, Operio guarda tus datos 30 días para poder recuperarlos y luego los borra, también de los respaldos conforme se renuevan.</p>
<p>Operio puede suspender un panel de inmediato si se incumplen estos términos, si pone en riesgo a otros clientes o los sistemas de Operio, o si la ley lo exige.</p>` },
        { heading: '12. Responsabilidad', html: `<p>En la medida en que la ley lo permita, Operio no responde por daños indirectos, incidentales o consecuentes, incluidas ganancias, datos u oportunidades perdidas. La responsabilidad total de Operio por cualquier reclamo se limita a lo que pagaste por ORCA Gestionado en los 3 meses anteriores al hecho que lo originó.</p>` },
        { heading: '13. Cambios a estos términos', html: `<p>Operio puede actualizar estos términos. La versión vigente siempre está en esta página con su fecha. Los cambios importantes se avisan por correo o en el panel al menos 14 días antes de aplicar.</p>` },
        { heading: '14. Ley aplicable', html: `<p>Estos términos se rigen por las leyes de la jurisdicción donde Operio está registrada, como indican los <a href="https://operio.work/es/terms">Términos de servicio</a> de Operio.</p>` },

        { heading: 'Parte C · Cómo trata Operio tus datos en ORCA Gestionado', part: true },
        { heading: '15. Papeles', html: `<p>Para los datos personales en tu panel (los de tu equipo y los de tus clientes en conversaciones, documentos y borradores), tú eres el responsable y Operio los trata por ti como encargado, solo para correr tu panel. Estos compromisos se suman a la <a href="https://operio.work/es/privacy">Política de privacidad</a> de Operio.</p>` },
        { heading: '16. Compromisos de Operio', html: `<ul>
<li><strong>Solo tus instrucciones.</strong> Operio trata tus datos como dicen estos términos y los ajustes de tu panel, y para nada más.</li>
<li><strong>Solo quien lo necesita.</strong> Solo el personal de Operio que opera tu panel tiene acceso, con confidencialidad, y solo para operarlo o ayudarte cuando lo pides. El personal de Operio puede leer el chat de tu equipo solo si tu administrador lo activa.</li>
<li><strong>Seguridad.</strong> El panel de cada cliente corre por separado en el servidor, detrás de un inicio de sesión, con conexiones cifradas. Las claves y secretos se guardan para que solo tu panel pueda leerlos y nunca se vuelven a mostrar completos. El servicio está vigilado.</li>
<li><strong>Proveedores.</strong> Operio usa un proveedor de hospedaje en la nube (servidores en Estados Unidos), un proveedor de DNS y seguridad de red, el proveedor de modelos que elijas (con tu propia cuenta) y, solo si lo activas, un servicio de lectura de páginas web. Tratan los datos con instrucciones de Operio. La lista vigente está disponible en <a href="mailto:privacy@operio.work">privacy@operio.work</a>, y se te avisa antes de agregar un proveedor nuevo.</li>
<li><strong>Incidentes.</strong> Si un incidente de seguridad afecta tus datos, Operio te avisa sin demora indebida, y dentro de las 72 horas siguientes a confirmarlo, con lo que se sabe y lo que se está haciendo.</li>
<li><strong>Tus solicitudes.</strong> Operio te ayuda a responder a las personas que ejercen sus derechos sobre datos en tu panel.</li>
<li><strong>Al final.</strong> Operio te entrega tus datos si los pides y los borra como dice la sección 11.</li>
<li><strong>Información.</strong> Si la pides, Operio te da la información que razonablemente necesites para mostrar que cumple estos compromisos.</li>
</ul>` },
      ],
      contactHeading: '17. Contacto',
      contactHtml: `<p>Dudas sobre estos términos: <a href="mailto:legal@operio.work">legal@operio.work</a>. Sobre tus datos: <a href="mailto:privacy@operio.work">privacy@operio.work</a>.</p>`,
    },
    privacy: {
      title: 'Privacidad de ORCA',
      metaTitle: 'Privacidad de ORCA: este sitio, ORCA gratis y ORCA Gestionado',
      description: 'Qué datos manejan este sitio, el panel ORCA gratuito y ORCA Gestionado por Operio, dónde se guardan, quién más los trata y tus derechos.',
      updated: UPDATED.es,
      intro: `<p>Este aviso explica qué datos maneja ORCA: en este sitio, en el panel gratuito en tu propia computadora y en ORCA Gestionado por Operio. Complementa la <a href="https://operio.work/es/privacy">Política de privacidad</a> de Operio, que es su aviso de privacidad integral: ahí están la empresa responsable de tus datos, su domicilio y cómo ejercer tus derechos ARCO conforme a la ley mexicana de protección de datos.</p>`,
      sections: [
        { heading: '1. Este sitio', html: `<ul>
<li>Sin cuenta, sin inicio de sesión, sin publicidad, sin analítica y sin cookies de rastreo.</li>
<li>Tu elección de tema (claro u oscuro) se guarda en tu propio navegador y nunca se nos envía.</li>
<li>Como cualquier servidor web, el nuestro registra cada solicitud (dirección IP, página, navegador y hora) por seguridad y para resolver problemas, y guarda esos registros poco tiempo.</li>
<li>Los enlaces a otros sitios de Operio, a GitHub y a la página de citas llevan a servicios con sus propios avisos de privacidad.</li>
</ul>` },
        { heading: '2. ORCA gratis en tu computadora', html: `<p>El panel gratuito corre en tu propia computadora y no le envía nada a Operio: ni telemetría ni reportes de uso. Tus agentes, documentos, bitácora y claves se quedan en tu computadora. Cuando instalas o actualizas, tu computadora descarga ORCA de este sitio o de GitHub, lo que, como cualquier descarga, le muestra tu dirección IP a ese servidor.</p>
<p>Los agentes que corres envían tus instrucciones y archivos a los proveedores de modelos que elijas, bajo las políticas de esos proveedores. Si activas el navegador web, las páginas se abren desde tu propia computadora.</p>` },
        { heading: '3. ORCA Gestionado: qué guarda Operio', html: `<ul>
<li><strong>Tu equipo:</strong> nombres, correos de acceso y roles.</li>
<li><strong>El trabajo de tu panel:</strong> sesiones y respuestas de los agentes, chat del equipo, bitácora, rutinas y sus borradores, agentes guardados, plantillas y los documentos de conocimiento que subes.</li>
<li><strong>Ajustes y secretos:</strong> la configuración de herramientas y las claves que usan tus agentes, guardadas para que solo tu panel pueda leerlas.</li>
<li><strong>Registros del servicio:</strong> accesos, errores y uso necesarios para operar, proteger y cobrar el servicio.</li>
</ul>` },
        { heading: '4. Para qué', html: `<p>Para correr tu panel y tus agentes, darte soporte, mantener seguro el servicio, cobrarte y cumplir obligaciones legales. Operio no usa tus datos para entrenar modelos de IA, no los vende y no los usa para publicidad.</p>` },
        { heading: '5. Dónde y quién más', html: `<p>Tu panel corre en servidores en Estados Unidos. Operio usa un proveedor de hospedaje en la nube, un proveedor de DNS y seguridad de red, el proveedor de modelos que elijas (con tu propia cuenta) y, solo si lo activas, un servicio de lectura de páginas web. Tratan los datos por cuenta de Operio y con sus instrucciones. La lista vigente está disponible en <a href="mailto:privacy@operio.work">privacy@operio.work</a>.</p>` },
        { heading: '6. Quién en Operio puede verlos', html: `<p>Solo el personal que opera tu panel, con confidencialidad, cuando lo necesita para operarlo o cuando pides ayuda. El chat de tu equipo solo es visible para Operio si tu administrador lo activa.</p>` },
        { heading: '7. Cuánto tiempo', html: `<p>Mientras tu panel esté activo. Después del cierre, Operio guarda tus datos 30 días para poder recuperarlos y luego los borra, también de los respaldos conforme se renuevan. Puedes pedir una copia antes del cierre, o que se borren antes.</p>` },
        { heading: '8. Tus derechos', html: `<p>Puedes pedir acceder, corregir o borrar tus datos personales, u oponerte a su uso, como explica la <a href="https://operio.work/es/privacy">Política de privacidad</a> de Operio, escribiendo a <a href="mailto:privacy@operio.work">privacy@operio.work</a>. Sobre los datos de tus clientes dentro de tu panel decide tu negocio, y Operio te ayuda a responder sus solicitudes.</p>` },
        { heading: '9. Cambios', html: `<p>La versión vigente siempre está en esta página con su fecha. Los cambios importantes se avisan por correo o en el panel al menos 14 días antes de aplicar.</p>` },
      ],
      contactHeading: '10. Contacto',
      contactHtml: `<p><a href="mailto:privacy@operio.work">privacy@operio.work</a></p>`,
    },
  },
};
