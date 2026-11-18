// UI copy for make.operio.work, EN + ES (Mexican Spanish, tú).
// Routine copy is NOT here: it comes from catalog/catalog.json only.

const en = {
  htmlLang: 'en',
  ogLocale: 'en_US',
  skip: 'Skip to content',
  nav: { catalog: 'Catalog', install: 'Install', compare: 'Compare', managed: 'Managed', buddy: 'ORCA Buddy', github: 'ORCA on GitHub', home: 'ORCA home', menu: 'Menu', closeMenu: 'Close the menu' },
  langSwitch: { label: 'Español', short: 'ES', aria: 'Ver esta página en español' },
  theme: { toDark: 'Switch to dark theme', toLight: 'Switch to light theme' },
  by: 'by',

  copy: { copy: 'Copy', copied: 'Copied', label: 'Copy the command', done: 'Command copied' },

  home: {
    title: 'ORCA by Operio: one board for all your AI agents',
    description:
      'ORCA is a free, open-source control panel for the AI agents on your own computer: one live board, phone alerts when an agent needs you, one-tap answers, and scheduled routines whose drafts wait for your OK.',
    headline: 'All your AI agents on one board, and\u00a0in your pocket.',
    lead:
      'ORCA shows what every agent is doing at a glance, alerts your phone when one needs you, and lets you answer with a tap. Free, open source, on your own computer.',
    acronymLabel: 'What ORCA stands for',
    acronym: [
      ['Orchestrate', 'your agents on one board'],
      ['Reply', 'from your phone'],
      ['Check', 'every status at a glance'],
      ['Approve', 'drafts before they go out']
    ],
    proofLead: 'Built by Operio.',
    proofBody: 'Our own team runs its agents on it every day: from the desk and from the phone.',
    installLabel: 'Install on Linux, macOS or Windows (WSL2)',
    installNote: 'Node.js 20 or newer. No account, no sudo.',
    installMore: 'Install guide',
    secondary: 'Have Operio run it for you',

    video: {
      play: 'Watch the demo',
      length: '0:50',
      playLabel: 'Play the ORCA demo video, 50 seconds, music only with no narration',
      label: 'ORCA demo video. Music only, no narration. Captions repeat the text shown on screen.',
      close: 'Close the video',
      captions: 'English',
      posterAlt:
        'ORCA demo: an agent stops to ask how to seat a party of eight, with three answers to tap.'
    },

    painsTitle: 'Several agents should not mean babysitting them',
    painsLead: 'Five things that slow you down once more than one agent is running, and what ORCA does about each.',
    painLabel: 'The problem',
    fixLabel: 'With ORCA',
    pains: [
      {
        id: 'needs-you',
        pain: 'Agents stall while you are in another window',
        painBody: 'An agent asks a question, then sits idle for an hour because you never saw it.',
        fix: 'Your phone tells you, and one tap answers',
        fixBody:
          'When an agent needs a decision, its tile turns red and your phone gets a “needs you” alert. Pick an answer and it gets back to work.',
        alt: 'An agent on a phone asking “How should I answer the Morgan party?”, with three answers to tap.'
      },
      {
        id: 'board',
        pain: 'Five agents, five tabs, no idea who is stuck',
        painBody: 'You click through terminals to find out who is working, who is done and who is waiting on you.',
        fix: 'One live board for every agent',
        fixBody:
          'Each agent is a tile painted by its status: working, needs you, done. You read the whole team at a glance.',
        alt: 'The live board: counts for needs you, working and idle, and four agent tiles in two groups, two of them red.'
      },
      {
        id: 'phone',
        pain: 'You can’t leave the desk while they run',
        painBody: 'Step away and the work stops, because the next question waits until you are back.',
        fix: 'Run them from your phone',
        fixBody:
          'Read the output, reply, and start new agents from anywhere, over a private connection to your own computer.',
        alt: 'ORCA on a phone: the New button, the status counts and the agent tiles.'
      },
      {
        id: 'approve',
        pain: 'The same instructions every morning, and drafts that go out unchecked',
        painBody: 'You retype the same tasks every day, and nothing stops a draft from leaving before you read it.',
        fix: 'Scheduled routines whose drafts wait for your OK',
        fixBody:
          'Save a task once and pick when it runs. What it writes waits in the Routines tab until you approve it.',
        alt: 'The Routines tab on a phone: a review-reply draft marked “needs approval”, with Approve and Reject buttons.'
      },
      {
        id: 'team',
        pain: 'Every agent starts from scratch, and one agent ends up doing everything',
        painBody: 'You paste the same instructions into each new agent, and side jobs pile up on whichever one is open.',
        fix: 'Saved agents, a lead, and workers that report back',
        fixBody:
          'Set an agent up once with its instructions, skills and tools. Give it a lead, and let it hand side jobs to workers that report back and close themselves, after you approve.',
        alt: 'Saved agents: a request from the sales lead for a researcher worker with Approve and Decline, a worker on a task with minutes left, and the sales lead.'
      }
    ],

    vsTitle: 'How ORCA compares',
    vsLines: [
      'herdr runs the terminals. ORCA adds the phone, the alerts, the routines and the approvals.',
      'Claude Code, Codex, Gemini, opencode and local models on one board, with a phone alert and one-tap answers, free on your own computer.',
      'Want it always on, without your computer? ORCA Managed by Operio runs it for you.'
    ],
    vsMore: 'Compare ORCA with five other tools',

    howTitle: 'How it works',
    steps: [
      {
        title: 'Install it',
        body: 'One line in the terminal. It starts with your computer and opens in your browser at 127.0.0.1:7171.'
      },
      {
        title: 'Start your agents',
        body: 'Open Claude Code, Codex, Gemini or opencode with the New button, or start one of your saved agents. Each one gets a tile on the board.'
      },
      {
        title: 'Answer from anywhere',
        body: 'Turn on phone alerts over a private connection. When an agent needs you, answer with a tap and carry on with your day.'
      }
    ],

    whatsNew: {
      "title": "What’s new in 0.4.0",
      "shots": [
        {
          "id": "agents",
          "caption": "Saved agents and workers",
          "alt": "The Saved agents list: a request from the sales lead for a researcher worker with Approve and Decline, a worker setup with one worker on a task and its minutes left, and the sales lead."
        },
        {
          "id": "admin",
          "caption": "Admin → Tools",
          "alt": "The Admin page on Tools: one connected calendar server marked Ready, a warning that servers you add run with your rights, and the form to add another."
        },
        {
          "id": "languages",
          "caption": "Five languages",
          "alt": "The language menu open in the header: English, Español, Français, Português and Italiano."
        }
      ],
      "items": [
        {
          "title": "Saved agents",
          "body": "Set an agent up once: instructions, skills, tools and which account it uses. Start it any time, or Resume to pick up its last conversation."
        },
        {
          "title": "Teams, two levels",
          "body": "An agent can report to a lead. When a member finishes a job, its result is offered to the lead, and the two can message each other."
        },
        {
          "title": "Workers for one task",
          "body": "Start a worker with a task and it reports back to its lead and closes itself. A lead can ask for one; you approve it first."
        },
        {
          "title": "Connect tools (MCP)",
          "body": "Add an MCP server once in Admin and tick it on an agent. Keys are saved once and never shown again; each agent only gets the keys it uses."
        },
        {
          "title": "More agents and accounts",
          "body": "Gemini and local models through Ollama join Claude, Codex and the rest. Several logins per agent kind, and Google API keys for Gemini and Antigravity."
        },
        {
          "title": "One Admin page, five languages",
          "body": "Agents, accounts, tools, skills, knowledge and activity in one place. The panel now speaks French, Portuguese and Italian too (machine-translated, review in progress)."
        }
      ],
      "note": "Also in 0.3.0: agents talking on the map, prompt templates, skills and knowledge for agents.",
      "changelog": 'Full changelog',
      "video": { "play": "Watch what’s new", "length": "0:50", "playLabel": "Play the video about what’s new in ORCA 0.4, 50 seconds, music only with no narration", "label": "What’s new in ORCA 0.4, video. Music only, no narration. Captions repeat the text shown on screen.", "close": "Close the video", "captions": "English", "posterAlt": "What’s new in ORCA 0.4: saved agents, teams, workers, tools and five languages." }
    },

    bizTitle: 'Run a business?',
    bizBody:
      'ORCA also runs office routines on a schedule: a morning brief, review replies, a weekly report. They read the files you give them and write a report or a draft. Nothing reaches your customers until you send it.',
    freeTitle: 'Five routines, free',
    freeOutput: { report: 'Report', draft: 'Draft you send' },
    managedTitle: 'Want it to run on its own?',
    managedBody:
      'ORCA Managed by Operio runs 18 more routines for you. They connect to WhatsApp, your Google Business Profile and your booking tools, and send with the approvals you set.',
    managedAll: 'See the full catalog',
    partnerBody: 'Agencies and consultants: offer managed routines to your clients and earn 25%.',
    partnerCta: 'Partner program',

    compareTitle: 'Free or managed',
    compareHead: { topic: 'What you get', free: 'ORCA', managed: 'ORCA Managed by Operio' },
    compareRows: [
      ['Where it runs', 'Your own computer', 'Operio runs it for you'],
      ['Who can use it', 'You, on your computer', 'Your team, with roles'],
      ['Team chat', 'No', 'Threads per agent, a team room, EN/ES translation'],
      ['Sending to customers', 'Never. You copy, paste and send', 'Yes, behind the approvals you set'],
      ['Setup', 'You install it with one line', 'Operio sets it up with you'],
      ['When something breaks', 'You check the log', 'Operio is watching and fixes it']
    ],
    compareFreeCta: 'Install free',
    seeDifferences: 'See every difference',

    team: {
      title: 'Your own panel, run by Operio',
      lead: 'The same ORCA, on a server Operio runs for you, with your team signed in.',
      items: [
        {
          title: 'Your team, with roles',
          body: 'Admins run the agents, viewers follow along and comment.'
        },
        {
          title: 'Team chat',
          body: 'A thread on every agent and one team room, with alerts when someone mentions you.'
        },
        {
          title: 'Ask an agent from the chat',
          body: 'Write @agent and the message goes to it as work; its answer comes back in the thread.'
        },
        {
          title: 'English and Spanish',
          body: 'Messages in both languages, translated with one tap.'
        },
        {
          title: 'Operio keeps it running',
          body: 'Model access, updates and monitoring handled by Operio.'
        }
      ]
    },

    securityTitle: 'It stays on your computer',
    security: [
      {
        title: 'Only your computer can open it',
        body: 'It listens on localhost only, so nothing on the internet can reach it. There is no account with us.'
      },
      {
        title: 'Your files stay where they are',
        body: 'Drafts, reports and logs live in your home folder. The only service that reads your files is the AI assistant you signed in to.'
      },
      {
        title: 'Other websites are shut out',
        body: 'It ignores requests from other sites and asks you before it opens a terminal.'
      },
      {
        title: 'Your phone, privately',
        body: 'Reach it from your phone through a private network or an SSH tunnel. Never open it to the internet.'
      }
    ],
    securityMore: 'Phone access and the full security model',

    faqTitle: 'Questions',
    faq: [
      {
        q: 'What does ORCA stand for?',
        a: 'Orchestrate, Reply, Check, Approve. Orchestrate your agents on one board, reply to them from your phone, check every status at a glance, and approve drafts before they go out.'
      },
      {
        q: 'Is it really free?',
        a: 'Yes. ORCA is open source under the MIT license, with no account and no trial period. The only cost is the AI assistant you already use.'
      },
      {
        q: 'Which AI agents does it work with?',
        a: 'Claude Code, Codex, opencode and other agents that run in a terminal. Install and sign in to them as usual; ORCA shows them, starts them and passes on your answers.'
      },
      {
        q: 'What do I need?',
        a: 'A computer with Linux, macOS or Windows (WSL2), Node.js 20 or newer, and at least one AI agent installed and signed in. For routines, the computer has to be on when they are scheduled. So far we have tested it on Linux; macOS and WSL2 are not tested yet.'
      },
      {
        q: 'Can I use it from my phone?',
        a: 'Yes, through a private network (Tailscale) or an SSH tunnel. The install guide shows both, step by step.'
      },
      {
        q: 'Will it message my customers?',
        a: 'No. Free routines only write reports and drafts, and you send them yourself. Sending on its own, with approvals, is what ORCA Managed by Operio does.'
      },
      {
        q: 'How can I see it before I set anything up?',
        a: 'Run operio-orca demo. It opens a second panel with two fictional businesses whose agents work, ask you questions and finish, with no real data and no cost.'
      },
      {
        q: 'Can my team use it?',
        a: 'The free panel is for one person on one computer. ORCA Managed by Operio adds people with roles and a team chat, and Operio runs it for you.'
      }
    ],

    finalTitle: 'Put every agent on one board',
    finalBody: 'One line to install. No account and no sudo.'
  },

  catalog: {
    title: 'Routine catalog',
    metaTitle: 'Routine catalog: 23 routines for local businesses | ORCA',
    description:
      '23 routines for restaurants, clinics, real estate, tourism and local shops. Five run free in ORCA on your computer; Operio runs the rest for you.',
    lead:
      'Routines for restaurants, clinics, real estate, tourism and local shops. Free ones run in ORCA on your computer. Managed ones run in ORCA Managed by Operio.',
    filterVertical: 'Business type',
    filterTier: 'Who runs it',
    all: 'All',
    showing: (n, total) => `${n} of ${total} routines`,
    none: 'No routines match. Try another business type.',
    reset: 'Show all'
  },

  tier: { free: 'Free', managed: 'Managed', freeLong: 'Free in ORCA', managedLong: 'ORCA Managed by Operio' },
  verticals: {
    any: 'Any business',
    restaurant: 'Restaurants',
    clinic: 'Clinics',
    'real-estate': 'Real estate',
    tourism: 'Tourism',
    retail: 'Shops',
    services: 'Services'
  },

  routine: {
    backToCatalog: 'Catalog',
    metaSuffix: 'ORCA routine',
    outcome: 'What you get',
    how: 'How it works',
    when: 'When it runs',
    approval: 'Approval',
    toolsFree: 'Reads exports from',
    toolsManaged: 'Works with',
    verticals: 'For',
    upgradeTitle: 'Want it to run on its own?',
    installTitle: 'Run it free',
    installSteps: [
      'Install ORCA with this line:',
      'Open 127.0.0.1:7171, go to Routines and turn on',
      'Drop your files in'
    ],
    installStepNoFolder: 'Press Run now, or let the schedule start it.',
    installGuide: 'Full install guide',
    managedTitle: 'Operio runs this one for you',
    managedBody:
      'This routine sends on your behalf or connects several of your tools, so it runs in ORCA Managed by Operio: Operio sets it up with you, runs it and keeps an eye on it.',
    managedFree: 'Or start with a free routine',
    related: 'Related routines'
  },

  install: {
    title: 'Install ORCA',
    metaTitle: 'Install ORCA: one line, Linux, macOS or Windows (WSL2)',
    description:
      'Install ORCA with one line on Linux, macOS or Windows (WSL2). Phone access, updates, the demo and uninstalling.',
    lead: 'One line on Linux, macOS or Windows (WSL2). It is safe to run again, and it never needs sudo.',
    toc: 'On this page',
    reqTitle: 'What you need',
    req: [
      'Linux (x86_64 or arm64), macOS (Apple silicon or Intel), or Windows through WSL2.',
      'Tested by us on Linux so far. macOS and WSL2 follow the same steps but are not tested yet; tell us on GitHub if something fails.',
      'Node.js 20 or newer.',
      'An AI assistant installed and signed in: Claude Code, Codex or opencode.',
      'A computer that is on when your routines are scheduled.'
    ],
    installTitle: 'Install',
    installAfter: 'Then open',
    installWhat: 'What the installer does',
    installSteps: [
      'Downloads the panel and herdr 0.9.5, the open-source terminal workspace it runs on, and checks the download against a fixed checksum.',
      'Installs to ~/.local/share/operio-orca and puts the operio-orca command in ~/.local/bin.',
      'Starts it with your computer: a systemd user service on Linux, a launchd agent on macOS. Add --no-service to skip that.',
      'Adds the five free routines, turned off until you switch them on.'
    ],
    sourceTitle: 'Prefer to read it first?',
    sourceBody: 'Download the script, read it, then run it. Or clone the repository and run it from there.',
    wslTitle: 'Windows (WSL2)',
    wslBody: 'On Windows, ORCA runs inside WSL2, the Linux system built into Windows. Set it up once, then use the same one-line install.',
    wslSteps: [
      'Open PowerShell as administrator, install WSL2 with Ubuntu, and restart if Windows asks:',
      'Open Ubuntu from the Start menu and create your user. Inside Ubuntu, install Node.js 20 or newer and your AI assistant.',
      'Run the same one-line install inside Ubuntu:'
    ],
    wslSystemdTitle: 'Make it start with Ubuntu',
    wslSystemdBody:
      'New WSL2 installs have systemd off, so the installer starts ORCA by hand and prints this recipe. Turn systemd on once, restart WSL, then run the install line again: from then on ORCA starts with Ubuntu.',
    wslSystemdSteps: ['In Ubuntu:', 'In PowerShell:', 'Open Ubuntu again and run the install line once more:'],
    wslNote: 'WSL2 support is new. If something does not work,',
    wslIssue: 'tell us on GitHub.',
    phoneTitle: 'Use it from your phone',
    phoneBody: 'ORCA listens on 127.0.0.1 only. Keep it that way and reach it through one of these.',
    tailscaleTitle: 'Tailscale (private network, HTTPS)',
    tailscaleSteps: [
      'Share the panel inside your private network:',
      'Add the name it prints to ~/.config/operio-orca/env:',
      'Restart, then open that name on your phone:'
    ],
    tailscaleNote: 'Phone alerts need HTTPS, so this is the way to get them.',
    sshTitle: 'SSH tunnel',
    sshBody: 'From the device you want to use, then open http://127.0.0.1:7171 on it:',
    phoneWarn: 'Never expose it to the internet: no port forwarding, no public links. There is no login, so anyone who can reach it can use it.',
    commandsTitle: 'Everyday commands',
    commands: [
      ['operio-orca status', 'Is it running, and where'],
      ['operio-orca restart', 'Restart after changing settings'],
      ['operio-orca stop', 'Stop it until you start it again'],
      ['operio-orca start', 'Start it again'],
      ['operio-orca open', 'Open it in your browser'],
      ['operio-orca doctor', 'Check the install and print the fix for anything wrong'],
      ['operio-orca logs', 'The panel log (logs herdr, logs routines; -f to follow)'],
      ['operio-orca backup', 'Save settings, routines, drafts and the journal to one file'],
      ['operio-orca restore FILE', 'Put a backup back (keeps a copy of what was there)'],
      ['operio-orca llm set NAME', 'Save an API key for your agents (typed hidden or piped in, never an argument)'],
      ['operio-orca llm list', 'The keys set, by name and last 4 characters (llm unset NAME removes one)'],
      ['operio-orca llm apply', 'Restart herdr so the agents get the keys (only when none is working)'],
      ['operio-orca llm test claude', 'One tiny prompt with the keys loaded: ok, or why not (claude, codex, opencode, gemini)']
    ],
    commandsWhyQ: 'Why operio-orca and not just orca?',
    commandsWhyA: 'Ubuntu and many Linux desktops already ship a program called orca: the GNOME screen reader. A distinct name keeps the two apart.',
    updateTitle: 'Update',
    updateBody: 'Updates the panel and herdr together, to versions that are tested with each other. Use this instead of updating herdr on its own.',
    updateCheck: 'To only see whether there is a newer version, without installing anything:',
    demoTitle: 'Try the demo',
    demoBody: 'A second panel on port 7172 with two fictional businesses, Harbor Street Bistro and Brightside Dental. No real data, no cost, and it never touches your own setup.',
    demoCmds: [
      ['operio-orca demo', 'Start it'],
      ['operio-orca demo --lang es', 'Play it in Spanish'],
      ['operio-orca demo --reset', 'Start over'],
      ['operio-orca demo --stop', 'Stop it']
    ],
    uninstallTitle: 'Uninstall',
    uninstallBody: 'Removes the panel and its service. Add --purge to also delete your settings, drafts and logs in ~/.config/operio-orca. Your AI assistants and their work are left alone.',
    helpTitle: 'Rather not run it yourself?',
    helpBody: 'Operio runs the routines for you, connected to your real tools and watched so they keep working.'
  },

  managedPage: {
    metaTitle: 'ORCA Managed by Operio: your own panel, your team, run by Operio',
    description:
      'The same ORCA on a server Operio runs for you: your own panel at orca.operio.work behind a login, your team with roles, a team chat with @agent and EN/ES translation, 23 routines, and updates, monitoring and backups handled by Operio.',
    title: 'Your own panel, run by Operio',
    lead:
      'The same ORCA, on a server Operio runs for you. Your team signs in at orca.operio.work and talks to the agents in a team chat, and Operio keeps it updated, watched and backed up.',
    installFree: 'Install the free version',

    plusTitle: 'Everything in free ORCA, plus',
    plus: [
      {
        title: 'Your team, with roles',
        body: 'Admins run the agents. Viewers follow along and comment.'
      },
      {
        title: 'Team chat',
        body: 'A thread on every agent and one team room, with unread badges and @mentions that alert your phone.'
      },
      {
        title: 'Ask an agent from the chat',
        body: 'Write @agent and the message goes to it as work. Its answer is posted back in the thread.'
      },
      {
        title: 'English and Spanish',
        body: 'Any message translated with one tap, in either direction.'
      },
      {
        title: 'Model access, set up by Operio',
        body: 'With your own subscription or key. Nothing to configure on your side.'
      },
      {
        title: 'Agents set up for you',
        body: 'Operio sets up your first saved agents and workers with your instructions. Your admins adjust them; viewers can’t.'
      },
      {
        title: 'Connected to your tools',
        body: 'Operio connects your calendar, CRM or shop through MCP. The keys stay with Operio and each agent only gets what it needs.'
      },
      {
        title: 'Updates, monitoring and backups',
        body: 'Handled by Operio. If something breaks, Operio sees it and fixes it.'
      }
    ],

    chat: {
      title: 'Team chat',
      lead: 'Your team and your agents in the same place, from the desk and from the phone.',
      desktopCaption: 'On the desk',
      desktopAlt:
        'The team chat on desktop: an agent’s thread with messages from two people, an @agent request and the agent’s answer posted back, with the team room in the sidebar.',
      phoneCaption: 'In your pocket',
      phoneAlt:
        'The team chat on a phone: the team room with an unread badge, a mention, and a Translate link under a message.',
      points: [
        'A thread on every agent and one room for the whole team. Follow the threads you care about and mute the rest.',
        '@mention someone and their phone gets an alert. Unread badges show what you have not read yet.',
        'Write @agent and the message goes to that agent as work, with the recent thread for context. Its answer comes back in the thread.',
        'Messages in English or Spanish, translated with one tap.',
        'Viewers read and comment, they do not run agents. Operio staff can read your chat only when your admin allows it. You can delete your own message within five minutes.'
      ]
    },

    diffTitle: 'Free or managed: every difference',
    diffHead: { topic: 'What you get', free: 'ORCA', managed: 'ORCA Managed by Operio' },
    diffRows: [
      ['Where it runs', 'Your own computer', 'A server Operio runs for you'],
      ['Who can use it', 'One person, on one computer', 'Your team, with roles: admins run the agents, viewers follow and comment'],
      ['Sign-in', 'None. It listens on localhost only', 'Your own panel at orca.operio.work, behind a login'],
      ['Team chat', 'No', 'A thread on every agent and a team room, with unread badges, @mentions and phone alerts'],
      ['Ask an agent from the chat', 'No', 'Yes. @agent sends the message as work and the answer comes back in the thread'],
      ['Translation EN/ES', 'No', 'Any message, with one tap'],
      ['Model access', 'Your own key file, or sign in inside the agent', 'Set up by Operio, with your subscription or key'],
      ['Saved agents, teams and workers', 'Yes, you set them up', 'Yes. Operio sets up the first ones; your admins adjust them'],
      ['Connected tools (MCP)', 'Your own servers, on your computer', 'Your business tools, connected by Operio; keys kept by Operio'],
      ['Panel languages', 'English, Spanish, French, Portuguese, Italian', 'The same five'],
      ['Routines', '5, free. They write reports or drafts', '23. The managed ones send'],
      ['Sending to customers', 'Never. You copy, paste and send', 'Yes, behind the approvals you set'],
      ['Updates', 'You run operio-orca update', 'Operio'],
      ['Monitoring', 'You check the log', 'Operio is watching'],
      ['Backups', 'One command, run by you', 'Operio'],
      ['Support', 'The GitHub repo', 'The Operio team']
    ],

    howTitle: 'How it starts',
    how: [
      {
        title: 'Talk to Operio',
        body: 'Tell us what your agents do and who on your team needs to see them.'
      },
      {
        title: 'Operio sets up your panel',
        body: 'Your panel at orca.operio.work, your model access, your first agents, the tools they connect to, and the routines you pick.'
      },
      {
        title: 'Your team signs in',
        body: 'Admins run the agents, viewers follow along, and the team chat is ready.'
      }
    ],

    faqTitle: 'Questions',
    faq: [
      {
        q: 'Can Operio read our chat?',
        a: 'Only when your admin turns it on. Until then, Operio staff cannot see your team chat.'
      },
      {
        q: 'Whose model account is used?',
        a: 'Yours: your subscription or your API key, set up by Operio. If you do not have one, Operio arranges one with you.'
      },
      {
        q: 'Can we go back to the free version?',
        a: 'Yes. It is the same ORCA, so your routines and your journal can come with you to your own computer.'
      }
    ],

    finalTitle: 'Your panel, your team, run by Operio',
    finalBody: 'Tell us about your agents and your team. Operio sets up the rest.'
  },

  buddyPage: {
    metaTitle: 'ORCA Buddy: the web errands that eat your afternoon, done for you (coming soon)',
    description:
      'ORCA Buddy is a coming Operio service: an assistant with its own computer and browser that chases invoices, drafts review replies, follows up leads and watches prices, and asks before it acts. Join the beta.',
    badge: 'Coming soon · Beta',
    title: 'The errands that eat your afternoon, done',
    lead:
      'ORCA Buddy has its own computer and browser. It logs in, reads, fills in the forms and writes the drafts, then asks you before it sends, posts or pays anything.',
    cta: 'Join the beta',
    ctaSecondary: 'See ORCA Managed',

    errandsTitle: 'Hand it the jobs nobody wants',
    errands: [
      { title: 'Chase an unpaid invoice', body: 'Finds what is overdue, drafts a polite reminder with the payment link, and follows up until it is paid.' },
      { title: 'Answer your Google reviews', body: 'Reads every new review and writes a reply in your voice, ready for you to approve.' },
      { title: 'Follow up new leads', body: 'Writes the WhatsApp or email follow-up you keep meaning to send, so no lead goes cold.' },
      { title: 'Prepare your day', body: 'Each morning, a one-page brief: today’s calls, open quotes and what is overdue.' },
      { title: 'Watch a page for you', body: 'Checks a supplier or competitor page on your schedule and tells you only when something changes.' },
      { title: 'Cancel what you don’t use', body: 'Finds forgotten trials and subscriptions and walks through the cancel steps, with your OK.' }
    ],

    howTitle: 'How it works',
    how: [
      { title: 'Ask', body: 'Write to it like a colleague, in the app, on WhatsApp or on Telegram.' },
      { title: 'It does the legwork', body: 'On its own computer it opens the sites, signs in, reads and fills in what is needed.' },
      { title: 'You say yes', body: 'Before it sends, posts or pays, it shows you exactly what it will do and waits for your OK.' }
    ],

    trustTitle: 'On your word, never behind your back',
    trust: [
      { title: 'Asks before it acts', body: 'Nothing goes out in your name and nothing is paid without your approval.' },
      { title: 'Spending limit', body: 'You set a monthly limit. It stops there.' },
      { title: 'Logins stay locked', body: 'Passwords live in a locked vault, never in the chat.' },
      { title: 'Every step on record', body: 'See what it did, when, and what each task cost.' }
    ],

    orcaTitle: 'Better with ORCA',
    orcaBody:
      'ORCA is the control room, Buddy is the one who goes out and does things. Your ORCA routines can hand Buddy an errand, and Buddy’s approval requests land in the same ORCA list on your phone.',

    betaTitle: 'The beta',
    betaLead: 'We are opening ORCA Buddy to a small group of Operio clients first.',
    beta: [
      'Set up and run by Operio, on a private computer just for your business',
      'Errands built around your own tools and processes',
      'A direct line to the Operio team while we shape it'
    ],

    faqTitle: 'Questions',
    faq: [
      { q: 'When can I use it?', a: 'Operio clients get it first, in the beta. Join the list and we will contact you when your spot opens.' },
      { q: 'Does it act without asking me?', a: 'No. It prepares everything, then waits for your OK before it sends, posts or pays.' },
      { q: 'What does it work with?', a: 'Gmail, Google Calendar, Slack, WhatsApp, and most websites you can use in a browser.' },
      { q: 'How much does it cost?', a: 'One price, all included: $349 USD a month. Beta clients pay $249 a month, locked for 12 months, with setup free.' },
      { q: 'Do I need ORCA?', a: 'No. Buddy works on its own, and it works best next to ORCA.' }
    ],

    finalTitle: 'Get your afternoons back',
    finalBody: 'Tell us which errands eat your week. We will tell you when Buddy is ready for them.'
  },

  footer: {
    tagline: 'One board for all your AI agents, on your own computer. Free and open source.',
    madeBy: 'ORCA is made by Operio',
    product: 'ORCA',
    operio: 'Operio',
    talk: 'Talk to Operio',
    partners: 'Partner program',
    website: 'operio.work',
    license: 'MIT license',
    runsOn: 'Runs on',
    runsOnLicense: '(Apache-2.0)',
    github: 'Source on GitHub',
    soon: 'soon'
  },
  notFound: { title: 'Page not found', body: 'That page does not exist. Try the catalog or the home page.' }
};

/** @type {typeof en} */
const es = {
  htmlLang: 'es-MX',
  ogLocale: 'es_MX',
  skip: 'Ir al contenido',
  nav: { catalog: 'Catálogo', install: 'Instalar', compare: 'Comparar', managed: 'Gestionado', buddy: 'ORCA Buddy', github: 'ORCA en GitHub', home: 'Inicio de ORCA', menu: 'Menú', closeMenu: 'Cerrar el menú' },
  langSwitch: { label: 'English', short: 'EN', aria: 'View this page in English' },
  theme: { toDark: 'Cambiar a tema oscuro', toLight: 'Cambiar a tema claro' },
  by: 'por',

  copy: { copy: 'Copiar', copied: 'Copiado', label: 'Copiar el comando', done: 'Comando copiado' },

  home: {
    title: 'ORCA por Operio: un tablero para todos tus agentes de IA',
    description:
      'ORCA es un panel gratuito y de código abierto para los agentes de IA de tu propia computadora: un tablero en vivo, avisos en el celular cuando un agente te necesita, respuestas con un toque y rutinas programadas cuyos borradores esperan tu visto bueno.',
    headline: 'Todos tus agentes de IA en un tablero, y en tu bolsillo.',
    lead:
      'ORCA te muestra de un vistazo qué hace cada agente, te avisa en el celular cuando uno te necesita y lo respondes con un toque. Gratis, de código abierto y en tu propia computadora.',
    acronymLabel: 'Qué significa ORCA',
    acronym: [
      ['Orquesta', 'tus agentes en un tablero'],
      ['Responde', 'desde tu celular'],
      ['Controla', 'cada estado de un vistazo'],
      ['Aprueba', 'los borradores antes de salir']
    ],
    proofLead: 'Hecho por Operio.',
    proofBody: 'Nuestro equipo maneja sus propios agentes con esto todos los días: desde el escritorio y desde el celular.',
    installLabel: 'Instala en Linux, macOS o Windows (WSL2)',
    installNote: 'Node.js 20 o más reciente. Sin cuenta, sin sudo.',
    installMore: 'Guía de instalación',
    secondary: 'Que Operio lo opere por ti',

    video: {
      play: 'Ver la demo',
      length: '0:50',
      playLabel: 'Reproducir el video de la demo de ORCA, 50 segundos, solo música y sin narración',
      label: 'Video de la demo de ORCA. Solo música, sin narración. Los subtítulos repiten el texto que aparece en pantalla.',
      close: 'Cerrar el video',
      captions: 'Español',
      posterAlt:
        'Demo de ORCA: un agente se detiene a preguntar dónde sentar a un grupo de ocho, con tres respuestas para tocar.'
    },

    painsTitle: 'Tener varios agentes no debería significar cuidarlos todo el día',
    painsLead: 'Cinco cosas que te frenan en cuanto corre más de un agente, y lo que ORCA hace con cada una.',
    painLabel: 'El problema',
    fixLabel: 'Con ORCA',
    pains: [
      {
        id: 'needs-you',
        pain: 'Tus agentes se quedan esperando mientras estás en otra ventana',
        painBody: 'Un agente te hace una pregunta y se queda parado una hora porque no la viste.',
        fix: 'Te avisa en el celular y respondes con un toque',
        fixBody:
          'Cuando un agente necesita una decisión, su recuadro se pone rojo y te llega un aviso de “te necesita”. Eliges una respuesta y vuelve a trabajar.',
        alt: 'Un agente en el celular pregunta “¿Cómo le respondo al grupo de Morgan?”, con tres respuestas para tocar.'
      },
      {
        id: 'board',
        pain: 'Cinco agentes, cinco pestañas y no sabes quién está atorado',
        painBody: 'Saltas de terminal en terminal para ver quién trabaja, quién terminó y quién te está esperando.',
        fix: 'Un tablero en vivo con todos tus agentes',
        fixBody:
          'Cada agente es un recuadro pintado según su estado: trabajando, te necesita, terminado. Ves a todo el equipo de un vistazo.',
        alt: 'El tablero en vivo: cuántos te necesitan, trabajan o están inactivos, y cuatro recuadros de agentes en dos grupos, dos en rojo.'
      },
      {
        id: 'phone',
        pain: 'No puedes despegarte del escritorio mientras corren',
        painBody: 'Te alejas y el trabajo se detiene, porque la siguiente pregunta espera a que regreses.',
        fix: 'Manéjalos desde tu celular',
        fixBody:
          'Lee lo que hacen, respóndeles y arranca agentes nuevos desde donde estés, con una conexión privada a tu propia computadora.',
        alt: 'ORCA en un celular: el botón Nuevo, los contadores de estado y los recuadros de los agentes.'
      },
      {
        id: 'approve',
        pain: 'Las mismas instrucciones cada mañana y borradores que salen sin revisar',
        painBody: 'Repites las mismas tareas todos los días y nada impide que un borrador salga antes de que lo leas.',
        fix: 'Rutinas programadas cuyos borradores esperan tu visto bueno',
        fixBody:
          'Guarda una tarea una vez y elige cuándo corre. Lo que escribe te espera en la pestaña Rutinas hasta que lo apruebas.',
        alt: 'La pestaña Rutinas en un celular: un borrador de respuestas a reseñas marcado “por aprobar”, con los botones Aprobar y Rechazar.'
      },
      {
        id: 'team',
        pain: 'Cada agente empieza de cero, y uno termina haciendo todo',
        painBody: 'Pegas las mismas instrucciones en cada agente nuevo, y los pendientes se acumulan en el que tengas abierto.',
        fix: 'Agentes guardados, un líder y trabajadores que reportan',
        fixBody:
          'Configura un agente una vez con sus instrucciones, habilidades y herramientas. Dale un líder y deja que pase pendientes a trabajadores que reportan y se cierran solos, después de que tú apruebas.',
        alt: 'Agentes guardados: una solicitud del líder de ventas para un trabajador investigador con Aprobar y Rechazar, un trabajador en una tarea con los minutos que le quedan, y el líder de ventas.'
      }
    ],

vsTitle: 'Cómo se compara ORCA',
    vsLines: [
      'herdr corre las terminales. ORCA le suma el celular, los avisos, las rutinas y las aprobaciones.',
      'Claude Code, Codex, Gemini, opencode y modelos locales en un tablero, con aviso al celular y respuestas con un toque, gratis en tu propia computadora.',
      '¿Lo quieres siempre prendido, sin tu computadora? ORCA Gestionado por Operio lo opera por ti.'
    ],
    vsMore: 'Compara ORCA con otras cinco herramientas',

    howTitle: 'Cómo funciona',
    steps: [
      {
        title: 'Instálalo',
        body: 'Una línea en la terminal. Arranca con tu computadora y se abre en tu navegador en 127.0.0.1:7171.'
      },
      {
        title: 'Arranca tus agentes',
        body: 'Abre Claude Code, Codex, Gemini u opencode con el botón Nuevo, o arranca uno de tus agentes guardados. Cada uno aparece como un recuadro en el tablero.'
      },
      {
        title: 'Responde desde donde estés',
        body: 'Activa los avisos en tu celular con una conexión privada. Cuando un agente te necesita, respondes con un toque y sigues con tu día.'
      }
    ],

    whatsNew: {
      "title": "Novedades de la 0.4.0",
      "shots": [
        {
          "id": "agents",
          "caption": "Agentes guardados y trabajadores",
          "alt": "La lista de agentes guardados: una solicitud del líder de ventas para un trabajador investigador con Aprobar y Rechazar, un trabajador en una tarea con los minutos que le quedan, y el líder de ventas."
        },
        {
          "id": "admin",
          "caption": "Administración → Herramientas",
          "alt": "La página de administración en Herramientas: un servidor de calendario conectado y listo, un aviso de que los servidores que agregas corren con tus permisos, y el formulario para agregar otro."
        },
        {
          "id": "languages",
          "caption": "Cinco idiomas",
          "alt": "El menú de idioma abierto en el encabezado: English, Español, Français, Português e Italiano."
        }
      ],
      "items": [
        {
          "title": "Agentes guardados",
          "body": "Configura un agente una vez: instrucciones, habilidades, herramientas y la cuenta que usa. Arráncalo cuando quieras o usa Retomar para seguir su última conversación."
        },
        {
          "title": "Equipos de dos niveles",
          "body": "Un agente puede reportar a un líder. Cuando un miembro termina un trabajo, su resultado se le ofrece al líder, y pueden escribirse."
        },
        {
          "title": "Trabajadores para una tarea",
          "body": "Inicia un trabajador con una tarea: le reporta a su líder y se cierra solo. Un líder puede pedir uno; tú lo apruebas primero."
        },
        {
          "title": "Conecta herramientas (MCP)",
          "body": "Agrega un servidor MCP una vez en Administración y márcalo en un agente. Las claves se guardan una vez y no se vuelven a mostrar; cada agente recibe solo las que usa."
        },
        {
          "title": "Más agentes y cuentas",
          "body": "Gemini y modelos locales con Ollama se suman a Claude, Codex y los demás. Varias cuentas por tipo de agente, y claves de API de Google para Gemini y Antigravity."
        },
        {
          "title": "Una página de administración, cinco idiomas",
          "body": "Agentes, cuentas, herramientas, habilidades, conocimiento y actividad en un solo lugar. El panel ahora también habla francés, portugués e italiano (traducción automática, en revisión)."
        }
      ],
      "note": "También en la 0.3.0: agentes conversando en el mapa, plantillas, habilidades y conocimiento para los agentes.",
      "changelog": 'Registro de cambios completo',
      "video": { "play": "Mira las novedades", "length": "0:50", "playLabel": "Reproduce el video de las novedades de ORCA 0.4, 50 segundos, solo música sin narración", "label": "Novedades de ORCA 0.4, video. Solo música, sin narración. Los subtítulos repiten el texto en pantalla.", "close": "Cerrar el video", "captions": "Español", "posterAlt": "Novedades de ORCA 0.4: agentes guardados, equipos, trabajadores, herramientas y cinco idiomas." }
    },

    bizTitle: '¿Tienes un negocio?',
    bizBody:
      'ORCA también corre rutinas de oficina a la hora que elijas: un resumen matutino, respuestas a reseñas, un reporte semanal. Leen los archivos que les das y escriben un reporte o un borrador. Nada les llega a tus clientes hasta que tú lo envías.',
    freeTitle: 'Cinco rutinas, gratis',
    freeOutput: { report: 'Reporte', draft: 'Borrador que tú envías' },
    managedTitle: '¿Quieres que corra sola?',
    managedBody:
      'ORCA Gestionado por Operio opera 18 rutinas más por ti. Se conectan a WhatsApp, a tu Perfil de Negocio de Google y a tus herramientas de reservas, y envían con las aprobaciones que tú pones.',
    managedAll: 'Ver el catálogo completo',
    partnerBody: 'Agencias y consultores: ofrece rutinas gestionadas a tus clientes y gana el 25%.',
    partnerCta: 'Programa de socios',

    compareTitle: 'Gratis o gestionado',
    compareHead: { topic: 'Qué obtienes', free: 'ORCA', managed: 'ORCA Gestionado por Operio' },
    compareRows: [
      ['Dónde corre', 'En tu propia computadora', 'Operio lo opera por ti'],
      ['Quién lo usa', 'Tú, en tu computadora', 'Tu equipo, con roles'],
      ['Chat de equipo', 'No', 'Hilos por agente, una sala de equipo, traducción EN/ES'],
      ['Envíos a clientes', 'Nunca. Tú copias, pegas y envías', 'Sí, con las aprobaciones que tú pones'],
      ['Instalación', 'La instalas tú con una línea', 'Operio la configura contigo'],
      ['Si algo falla', 'Revisas el registro', 'Operio lo vigila y lo arregla']
    ],
    compareFreeCta: 'Instalar gratis',
    seeDifferences: 'Ver todas las diferencias',

    team: {
      title: 'Tu propio panel, operado por Operio',
      lead: 'El mismo ORCA, en un servidor que Operio opera por ti, con tu equipo conectado.',
      items: [
        {
          title: 'Tu equipo, con roles',
          body: 'Los administradores manejan los agentes; los observadores siguen el trabajo y comentan.'
        },
        {
          title: 'Chat de equipo',
          body: 'Un hilo en cada agente y una sala para todo el equipo, con avisos cuando alguien te menciona.'
        },
        {
          title: 'Pídele algo a un agente desde el chat',
          body: 'Escribe @agente y el mensaje le llega como trabajo; su respuesta vuelve al hilo.'
        },
        {
          title: 'En inglés y en español',
          body: 'Mensajes en los dos idiomas, traducidos con un toque.'
        },
        {
          title: 'Operio lo mantiene funcionando',
          body: 'Acceso a los modelos, actualizaciones y monitoreo a cargo de Operio.'
        }
      ]
    },

    securityTitle: 'Se queda en tu computadora',
    security: [
      {
        title: 'Solo tu computadora lo abre',
        body: 'Escucha únicamente en localhost, así que nada en internet puede alcanzarlo. No hay cuenta con nosotros.'
      },
      {
        title: 'Tus archivos se quedan donde están',
        body: 'Borradores, reportes y registros viven en tu carpeta personal. El único servicio que lee tus archivos es el asistente de IA con el que iniciaste sesión.'
      },
      {
        title: 'Otros sitios quedan fuera',
        body: 'Ignora las solicitudes de otros sitios web y te pregunta antes de abrir una terminal.'
      },
      {
        title: 'Tu celular, en privado',
        body: 'Ábrelo desde tu celular con una red privada o un túnel SSH. Nunca lo abras a internet.'
      }
    ],
    securityMore: 'Acceso desde el celular y el modelo de seguridad completo',

    faqTitle: 'Preguntas',
    faq: [
      {
        q: '¿Qué significa ORCA?',
        a: 'Orquesta, Responde, Controla, Aprueba. Orquesta tus agentes en un solo tablero, respóndeles desde tu celular, controla cada estado de un vistazo y aprueba los borradores antes de que salgan.'
      },
      {
        q: '¿De verdad es gratis?',
        a: 'Sí. ORCA es de código abierto con licencia MIT, sin cuenta y sin periodo de prueba. Lo único que pagas es el asistente de IA que ya usas.'
      },
      {
        q: '¿Con qué agentes de IA funciona?',
        a: 'Con Claude Code, Codex, opencode y otros agentes que corren en una terminal. Los instalas e inicias sesión como siempre; ORCA los muestra, los arranca y les pasa tus respuestas.'
      },
      {
        q: '¿Qué necesito?',
        a: 'Una computadora con Linux, macOS o Windows (WSL2), Node.js 20 o más reciente y al menos un agente de IA instalado y con sesión iniciada. Para las rutinas, la computadora tiene que estar prendida a la hora programada. Hasta ahora lo hemos probado en Linux; macOS y WSL2 aún no.'
      },
      {
        q: '¿Lo puedo usar desde mi celular?',
        a: 'Sí, con una red privada (Tailscale) o un túnel SSH. La guía de instalación muestra las dos formas, paso a paso.'
      },
      {
        q: '¿Les va a escribir a mis clientes?',
        a: 'No. Las rutinas gratis solo escriben reportes y borradores, y tú los envías. Enviar por su cuenta, con aprobaciones, es lo que hace ORCA Gestionado por Operio.'
      },
      {
        q: '¿Cómo lo veo antes de configurar algo?',
        a: 'Corre operio-orca demo. Abre un segundo panel con dos negocios ficticios cuyos agentes trabajan, te hacen preguntas y terminan, sin datos reales y sin costo.'
      },
      {
        q: '¿Lo puede usar mi equipo?',
        a: 'El panel gratis es para una persona en una computadora. ORCA Gestionado por Operio agrega personas con roles y un chat de equipo, y Operio lo opera por ti.'
      }
    ],

    finalTitle: 'Pon a todos tus agentes en un solo tablero',
    finalBody: 'Una línea para instalar. Sin cuenta y sin sudo.'
  },

  catalog: {
    title: 'Catálogo de rutinas',
    metaTitle: 'Catálogo de rutinas: 23 rutinas para negocios locales | ORCA',
    description:
      '23 rutinas para restaurantes, clínicas, bienes raíces, turismo y tiendas. Cinco corren gratis en ORCA en tu computadora; Operio opera las demás por ti.',
    lead:
      'Rutinas para restaurantes, clínicas, bienes raíces, turismo y tiendas. Las gratis corren en ORCA en tu computadora. Las gestionadas corren en ORCA Gestionado por Operio.',
    filterVertical: 'Tipo de negocio',
    filterTier: 'Quién la opera',
    all: 'Todas',
    showing: (n, total) => `${n} de ${total} rutinas`,
    none: 'Ninguna rutina coincide. Prueba otro tipo de negocio.',
    reset: 'Ver todas'
  },

  tier: { free: 'Gratis', managed: 'Gestionada', freeLong: 'Gratis en ORCA', managedLong: 'ORCA Gestionado por Operio' },
  verticals: {
    any: 'Cualquier negocio',
    restaurant: 'Restaurantes',
    clinic: 'Clínicas',
    'real-estate': 'Bienes raíces',
    tourism: 'Turismo',
    retail: 'Tiendas',
    services: 'Servicios'
  },

  routine: {
    backToCatalog: 'Catálogo',
    metaSuffix: 'rutina de ORCA',
    outcome: 'Qué obtienes',
    how: 'Cómo funciona',
    when: 'Cuándo corre',
    approval: 'Aprobación',
    toolsFree: 'Lee archivos exportados de',
    toolsManaged: 'Funciona con',
    verticals: 'Para',
    upgradeTitle: '¿Quieres que corra sola?',
    installTitle: 'Córrela gratis',
    installSteps: [
      'Instala ORCA con esta línea:',
      'Abre 127.0.0.1:7171, ve a Rutinas y activa',
      'Deja tus archivos en'
    ],
    installStepNoFolder: 'Pulsa Ejecutar ahora, o deja que el horario la inicie.',
    installGuide: 'Guía de instalación completa',
    managedTitle: 'Esta la opera Operio por ti',
    managedBody:
      'Esta rutina envía en tu nombre o conecta varias de tus herramientas, así que corre en ORCA Gestionado por Operio: Operio la configura contigo, la corre y la vigila.',
    managedFree: 'O empieza con una rutina gratis',
    related: 'Rutinas relacionadas'
  },

  install: {
    title: 'Instala ORCA',
    metaTitle: 'Instala ORCA: una línea, Linux, macOS o Windows (WSL2)',
    description:
      'Instala ORCA con una línea en Linux, macOS o Windows (WSL2). Acceso desde el celular, actualizaciones, la demo y cómo desinstalar.',
    lead: 'Una línea en Linux, macOS o Windows (WSL2). Puedes correrla de nuevo sin problema y nunca necesita sudo.',
    toc: 'En esta página',
    reqTitle: 'Qué necesitas',
    req: [
      'Linux (x86_64 o arm64), macOS (Apple silicon o Intel), o Windows con WSL2.',
      'Hasta ahora lo probamos en Linux. macOS y WSL2 siguen los mismos pasos, pero aún no los hemos probado; cuéntanos en GitHub si algo falla.',
      'Node.js 20 o más reciente.',
      'Un asistente de IA instalado y con sesión iniciada: Claude Code, Codex u opencode.',
      'Una computadora que esté prendida a la hora de tus rutinas.'
    ],
    installTitle: 'Instalación',
    installAfter: 'Luego abre',
    installWhat: 'Qué hace el instalador',
    installSteps: [
      'Descarga el panel y herdr 0.9.5, el espacio de trabajo de terminal de código abierto sobre el que corre, y revisa la descarga contra una suma de verificación fija.',
      'Instala en ~/.local/share/operio-orca y deja el comando operio-orca en ~/.local/bin.',
      'Lo arranca con tu computadora: un servicio de usuario de systemd en Linux, un agente de launchd en macOS. Agrega --no-service para omitirlo.',
      'Agrega las cinco rutinas gratis, apagadas hasta que las actives.'
    ],
    sourceTitle: '¿Prefieres leerlo antes?',
    sourceBody: 'Descarga el script, léelo y luego córrelo. O clona el repositorio y córrelo desde ahí.',
    wslTitle: 'Windows (WSL2)',
    wslBody: 'En Windows, ORCA corre dentro de WSL2, el sistema Linux que viene con Windows. Lo configuras una vez y luego usas la misma instalación de una línea.',
    wslSteps: [
      'Abre PowerShell como administrador, instala WSL2 con Ubuntu y reinicia si Windows te lo pide:',
      'Abre Ubuntu desde el menú Inicio y crea tu usuario. Dentro de Ubuntu, instala Node.js 20 o más reciente y tu asistente de IA.',
      'Corre la misma instalación de una línea dentro de Ubuntu:'
    ],
    wslSystemdTitle: 'Que arranque con Ubuntu',
    wslSystemdBody:
      'Las instalaciones nuevas de WSL2 traen systemd apagado, así que el instalador arranca ORCA a mano y muestra esta receta. Activa systemd una vez, reinicia WSL y corre de nuevo la línea de instalación: desde entonces ORCA arranca con Ubuntu.',
    wslSystemdSteps: ['En Ubuntu:', 'En PowerShell:', 'Abre Ubuntu de nuevo y corre la línea de instalación otra vez:'],
    wslNote: 'El soporte para WSL2 es nuevo. Si algo no funciona,',
    wslIssue: 'cuéntanos en GitHub.',
    phoneTitle: 'Úsalo desde tu celular',
    phoneBody: 'ORCA escucha solo en 127.0.0.1. Déjalo así y entra con una de estas opciones.',
    tailscaleTitle: 'Tailscale (red privada, HTTPS)',
    tailscaleSteps: [
      'Comparte el panel dentro de tu red privada:',
      'Agrega el nombre que muestra a ~/.config/operio-orca/env:',
      'Reinicia y abre ese nombre en tu celular:'
    ],
    tailscaleNote: 'Las alertas en el celular necesitan HTTPS, así que esta es la forma de tenerlas.',
    sshTitle: 'Túnel SSH',
    sshBody: 'Desde el dispositivo que quieres usar; luego abre http://127.0.0.1:7171 en él:',
    phoneWarn: 'Nunca lo expongas a internet: sin reenvío de puertos, sin enlaces públicos. No tiene inicio de sesión, así que quien lo alcance lo puede usar.',
    commandsTitle: 'Comandos del día a día',
    commands: [
      ['operio-orca status', 'Si está corriendo, y dónde'],
      ['operio-orca restart', 'Reinicia después de cambiar la configuración'],
      ['operio-orca stop', 'Lo detiene hasta que lo inicies de nuevo'],
      ['operio-orca start', 'Lo inicia de nuevo'],
      ['operio-orca open', 'Lo abre en tu navegador'],
      ['operio-orca doctor', 'Revisa la instalación y muestra cómo arreglar lo que falle'],
      ['operio-orca logs', 'El registro del panel (logs herdr, logs routines; -f para seguirlo)'],
      ['operio-orca backup', 'Guarda configuración, rutinas, borradores y bitácora en un archivo'],
      ['operio-orca restore ARCHIVO', 'Regresa un respaldo (conserva una copia de lo que había)'],
      ['operio-orca llm set NOMBRE', 'Guarda una clave de API para tus agentes (oculta al escribirla o por tubería, nunca como argumento)'],
      ['operio-orca llm list', 'Las claves guardadas, por nombre y últimos 4 caracteres (llm unset NOMBRE quita una)'],
      ['operio-orca llm apply', 'Reinicia herdr para que los agentes reciban las claves (solo si ninguno está trabajando)'],
      ['operio-orca llm test claude', 'Una prueba mínima con las claves cargadas: ok, o por qué no (claude, codex, opencode, gemini)']
    ],
    commandsWhyQ: '¿Por qué operio-orca y no solo orca?',
    commandsWhyA: 'Ubuntu y muchos escritorios Linux ya traen un programa llamado orca: el lector de pantalla de GNOME. Un nombre distinto evita que se confundan.',
    updateTitle: 'Actualizar',
    updateBody: 'Actualiza el panel y herdr juntos, a versiones probadas entre sí. Úsalo en lugar de actualizar herdr por separado.',
    updateCheck: 'Para solo ver si hay una versión nueva, sin instalar nada:',
    demoTitle: 'Prueba la demo',
    demoBody: 'Un segundo panel en el puerto 7172 con dos negocios ficticios, Harbor Street Bistro y Brightside Dental. Sin datos reales, sin costo, y nunca toca tu propia configuración.',
    demoCmds: [
      ['operio-orca demo', 'La inicia'],
      ['operio-orca demo --lang es', 'La reproduce en español'],
      ['operio-orca demo --reset', 'Empieza desde cero'],
      ['operio-orca demo --stop', 'La detiene']
    ],
    uninstallTitle: 'Desinstalar',
    uninstallBody: 'Quita el panel y su servicio. Agrega --purge para borrar también tu configuración, borradores y registros en ~/.config/operio-orca. Tus asistentes de IA y su trabajo no se tocan.',
    helpTitle: '¿Prefieres no correrlo tú?',
    helpBody: 'Operio opera las rutinas por ti, conectadas a tus herramientas reales y vigiladas para que sigan funcionando.'
  },

  managedPage: {
    metaTitle: 'ORCA Gestionado por Operio: tu propio panel, tu equipo, operado por Operio',
    description:
      'El mismo ORCA en un servidor que Operio opera por ti: tu propio panel en orca.operio.work con inicio de sesión, tu equipo con roles, un chat de equipo con @agente y traducción EN/ES, 23 rutinas, y actualizaciones, monitoreo y respaldos a cargo de Operio.',
    title: 'Tu propio panel, operado por Operio',
    lead:
      'El mismo ORCA, en un servidor que Operio opera por ti. Tu equipo entra en orca.operio.work y les habla a los agentes en un chat de equipo, y Operio lo mantiene actualizado, vigilado y respaldado.',
    installFree: 'Instala la versión gratis',

    plusTitle: 'Todo lo de ORCA gratis, más',
    plus: [
      {
        title: 'Tu equipo, con roles',
        body: 'Los administradores manejan los agentes. Los observadores siguen el trabajo y comentan.'
      },
      {
        title: 'Chat de equipo',
        body: 'Un hilo en cada agente y una sala para todo el equipo, con contadores de no leídos y @menciones que avisan al celular.'
      },
      {
        title: 'Pídele algo a un agente desde el chat',
        body: 'Escribe @agente y el mensaje le llega como trabajo. Su respuesta se publica en el hilo.'
      },
      {
        title: 'En inglés y en español',
        body: 'Cualquier mensaje traducido con un toque, en las dos direcciones.'
      },
      {
        title: 'Acceso a los modelos, configurado por Operio',
        body: 'Con tu propia suscripción o tu clave. Nada que configurar de tu lado.'
      },
      {
        title: 'Agentes configurados para ti',
        body: 'Operio configura tus primeros agentes guardados y trabajadores con tus instrucciones. Tus administradores los ajustan; los observadores no.'
      },
      {
        title: 'Conectado a tus herramientas',
        body: 'Operio conecta tu calendario, tu CRM o tu tienda por MCP. Las claves se quedan con Operio y cada agente recibe solo lo que necesita.'
      },
      {
        title: 'Actualizaciones, monitoreo y respaldos',
        body: 'A cargo de Operio. Si algo falla, Operio lo ve y lo arregla.'
      }
    ],

    chat: {
      title: 'Chat de equipo',
      lead: 'Tu equipo y tus agentes en el mismo lugar, desde el escritorio y desde el celular.',
      desktopCaption: 'En el escritorio',
      desktopAlt:
        'El chat de equipo en escritorio: el hilo de un agente con mensajes de dos personas, una petición con @agente y la respuesta del agente publicada en el hilo, con la sala de equipo en la barra lateral.',
      phoneCaption: 'En tu bolsillo',
      phoneAlt:
        'El chat de equipo en un celular: la sala de equipo con un contador de no leídos, una mención y un enlace Traducir debajo de un mensaje.',
      points: [
        'Un hilo en cada agente y una sala para todo el equipo. Sigue los hilos que te importan y silencia los demás.',
        'Menciona a alguien con @ y le llega un aviso al celular. Los contadores de no leídos te muestran lo que te falta leer.',
        'Escribe @agente y el mensaje le llega a ese agente como trabajo, con los mensajes recientes del hilo como contexto. Su respuesta vuelve al hilo.',
        'Mensajes en inglés o en español, traducidos con un toque.',
        'Los observadores leen y comentan, no manejan agentes. El personal de Operio solo puede leer tu chat cuando tu administrador lo permite. Puedes borrar tu propio mensaje durante cinco minutos.'
      ]
    },

    diffTitle: 'Gratis o gestionado: todas las diferencias',
    diffHead: { topic: 'Qué obtienes', free: 'ORCA', managed: 'ORCA Gestionado por Operio' },
    diffRows: [
      ['Dónde corre', 'En tu propia computadora', 'En un servidor que Operio opera por ti'],
      ['Quién lo usa', 'Una persona, en una computadora', 'Tu equipo, con roles: los administradores manejan los agentes, los observadores siguen y comentan'],
      ['Inicio de sesión', 'Ninguno. Escucha solo en localhost', 'Tu propio panel en orca.operio.work, con inicio de sesión'],
      ['Chat de equipo', 'No', 'Un hilo en cada agente y una sala de equipo, con contadores de no leídos, @menciones y avisos al celular'],
      ['Pedirle algo a un agente desde el chat', 'No', 'Sí. @agente le manda el mensaje como trabajo y la respuesta vuelve al hilo'],
      ['Traducción EN/ES', 'No', 'Cualquier mensaje, con un toque'],
      ['Acceso a los modelos', 'Tu propio archivo de claves, o inicias sesión dentro del agente', 'Lo configura Operio, con tu suscripción o tu clave'],
      ['Agentes guardados, equipos y trabajadores', 'Sí, tú los configuras', 'Sí. Operio configura los primeros; tus administradores los ajustan'],
      ['Herramientas conectadas (MCP)', 'Tus propios servidores, en tu computadora', 'Las herramientas de tu negocio, conectadas por Operio; las claves las guarda Operio'],
      ['Idiomas del panel', 'Inglés, español, francés, portugués e italiano', 'Los mismos cinco'],
      ['Rutinas', '5, gratis. Escriben reportes o borradores', '23. Las gestionadas envían'],
      ['Envíos a clientes', 'Nunca. Tú copias, pegas y envías', 'Sí, con las aprobaciones que tú pones'],
      ['Actualizaciones', 'Tú corres operio-orca update', 'Operio'],
      ['Monitoreo', 'Revisas el registro', 'Operio lo vigila'],
      ['Respaldos', 'Un comando, lo corres tú', 'Operio'],
      ['Soporte', 'El repositorio en GitHub', 'El equipo de Operio']
    ],

    howTitle: 'Cómo empieza',
    how: [
      {
        title: 'Habla con Operio',
        body: 'Cuéntanos qué hacen tus agentes y quién de tu equipo necesita verlos.'
      },
      {
        title: 'Operio configura tu panel',
        body: 'Tu panel en orca.operio.work, tu acceso a los modelos, tus primeros agentes, las herramientas a las que se conectan y las rutinas que elijas.'
      },
      {
        title: 'Tu equipo entra',
        body: 'Los administradores manejan los agentes, los observadores siguen el trabajo, y el chat de equipo queda listo.'
      }
    ],

    faqTitle: 'Preguntas',
    faq: [
      {
        q: '¿Operio puede leer nuestro chat?',
        a: 'Solo cuando tu administrador lo activa. Mientras no lo haga, el personal de Operio no ve tu chat de equipo.'
      },
      {
        q: '¿Qué cuenta de modelo se usa?',
        a: 'La tuya: tu suscripción o tu clave de API, configurada por Operio. Si no tienes una, Operio la consigue contigo.'
      },
      {
        q: '¿Podemos regresar a la versión gratis?',
        a: 'Sí. Es el mismo ORCA, así que tus rutinas y tu bitácora se van contigo a tu propia computadora.'
      }
    ],

    finalTitle: 'Tu panel, tu equipo, operado por Operio',
    finalBody: 'Cuéntanos de tus agentes y de tu equipo. Operio configura el resto.'
  },

  buddyPage: {
    metaTitle: 'ORCA Buddy: los mandados en internet que te quitan la tarde, hechos por ti (próximamente)',
    description:
      'ORCA Buddy es un próximo servicio de Operio: un asistente con su propia computadora y navegador que cobra facturas, redacta respuestas a reseñas, da seguimiento a prospectos y vigila precios, y te pregunta antes de actuar. Únete a la beta.',
    badge: 'Próximamente · Beta',
    title: 'Los mandados que te quitan la tarde, hechos',
    lead:
      'ORCA Buddy tiene su propia computadora y navegador. Entra a tus cuentas, lee, llena los formularios y escribe los borradores, y te pregunta antes de enviar, publicar o pagar algo.',
    cta: 'Únete a la beta',
    ctaSecondary: 'Ver ORCA Gestionado',

    errandsTitle: 'Dale los pendientes que nadie quiere',
    errands: [
      { title: 'Cobrar una factura vencida', body: 'Encuentra lo vencido, redacta un recordatorio amable con el link de pago y da seguimiento hasta que te paguen.' },
      { title: 'Responder tus reseñas de Google', body: 'Lee cada reseña nueva y escribe una respuesta con tu estilo, lista para que la apruebes.' },
      { title: 'Dar seguimiento a prospectos', body: 'Escribe el WhatsApp o correo de seguimiento que siempre dejas para después, para que ningún cliente se enfríe.' },
      { title: 'Preparar tu día', body: 'Cada mañana, un resumen de una página: llamadas de hoy, cotizaciones abiertas y lo vencido.' },
      { title: 'Vigilar una página por ti', body: 'Revisa la página de un proveedor o de la competencia cuando tú digas y te avisa solo si algo cambia.' },
      { title: 'Cancelar lo que no usas', body: 'Encuentra pruebas gratis y suscripciones olvidadas y hace los pasos para cancelarlas, con tu visto bueno.' }
    ],

    howTitle: 'Cómo funciona',
    how: [
      { title: 'Pídeselo', body: 'Escríbele como a un compañero, en la app, por WhatsApp o por Telegram.' },
      { title: 'Hace el trabajo pesado', body: 'En su propia computadora abre los sitios, entra, lee y llena lo que haga falta.' },
      { title: 'Tú dices que sí', body: 'Antes de enviar, publicar o pagar, te muestra exactamente qué va a hacer y espera tu visto bueno.' }
    ],

    trustTitle: 'Con tu permiso, nunca a tus espaldas',
    trust: [
      { title: 'Pregunta antes de actuar', body: 'Nada sale a tu nombre y nada se paga sin tu aprobación.' },
      { title: 'Límite de gasto', body: 'Tú pones un límite mensual. Ahí se detiene.' },
      { title: 'Tus accesos, bajo llave', body: 'Las contraseñas viven en una bóveda cerrada, nunca en el chat.' },
      { title: 'Cada paso queda registrado', body: 'Ve qué hizo, cuándo y cuánto costó cada tarea.' }
    ],

    orcaTitle: 'Mejor con ORCA',
    orcaBody:
      'ORCA es el centro de control y Buddy es quien sale a hacer las cosas. Tus rutinas de ORCA pueden pasarle un mandado a Buddy, y las solicitudes de aprobación de Buddy llegan a la misma lista de ORCA en tu teléfono.',

    betaTitle: 'La beta',
    betaLead: 'Abrimos ORCA Buddy primero a un grupo pequeño de clientes de Operio.',
    beta: [
      'Configurado y operado por Operio, en una computadora privada solo para tu negocio',
      'Mandados hechos a la medida de tus herramientas y procesos',
      'Línea directa con el equipo de Operio mientras le damos forma'
    ],

    faqTitle: 'Preguntas',
    faq: [
      { q: '¿Cuándo lo puedo usar?', a: 'Los clientes de Operio lo reciben primero, en la beta. Únete a la lista y te contactamos cuando se abra tu lugar.' },
      { q: '¿Actúa sin preguntarme?', a: 'No. Prepara todo y espera tu visto bueno antes de enviar, publicar o pagar.' },
      { q: '¿Con qué funciona?', a: 'Gmail, Google Calendar, Slack, WhatsApp y la mayoría de los sitios que usas en un navegador.' },
      { q: '¿Cuánto cuesta?', a: 'Un solo precio, todo incluido: $5,900 MXN al mes (IVA incluido). Los clientes beta pagan $4,500 MXN al mes, garantizados 12 meses, con la configuración gratis.' },
      { q: '¿Necesito ORCA?', a: 'No. Buddy funciona solo, y funciona mejor junto a ORCA.' }
    ],

    finalTitle: 'Recupera tus tardes',
    finalBody: 'Cuéntanos qué mandados te quitan la semana. Te avisamos cuando Buddy esté listo para ellos.'
  },

  footer: {
    tagline: 'Un tablero para todos tus agentes de IA, en tu propia computadora. Gratis y de código abierto.',
    madeBy: 'ORCA es de Operio',
    product: 'ORCA',
    operio: 'Operio',
    talk: 'Habla con Operio',
    partners: 'Programa de socios',
    website: 'operio.work',
    license: 'Licencia MIT',
    runsOn: 'Corre sobre',
    runsOnLicense: '(Apache-2.0)',
    github: 'Código en GitHub',
    soon: 'pronto'
  },
  notFound: { title: 'Página no encontrada', body: 'Esa página no existe. Prueba el catálogo o la página de inicio.' }
};

export const dict = { en, es };

/** @param {string | undefined} lang */
export const t = (lang) => (lang === 'es' ? es : en);
