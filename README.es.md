# Free-ORCA

![Demo de Free-ORCA: la rutina de reservas pregunta dónde sentar a un grupo de ocho, un toque lo responde y sigue trabajando](docs/readme-demo.gif)

Un panel de control gratuito y autoalojado para los agentes de IA que corres en tu propia
computadora (Claude Code, Codex, opencode y otros), con **rutinas** programadas cuyos
borradores esperan tu aprobación. Por [Operio](https://make.operio.work). Licencia MIT.

[English](README.md)

- Ve a cada agente en un mapa en vivo: trabajando, inactivo, terminado o esperándote.
- Lee lo que escribe un agente, respóndele, contesta sus preguntas con un toque, inicia agentes nuevos.
- Alertas en el teléfono (web push, opcional) cuando un agente termina o te necesita.
- Rutinas: un agente arranca en un horario con una tarea fija y escribe un borrador o reporte.
  Nunca se envía, publica ni manda por correo nada por ti.

Free-ORCA **funciona sobre [herdr](https://github.com/herdrdev/herdr)**, el espacio de trabajo
en terminal para agentes de IA de Can Celik y colaboradores (Apache-2.0). herdr no es nuestro:
el instalador descarga su versión oficial y la verifica. Ver `THIRD_PARTY_NOTICES.md`.

## Instalación

Linux (x86_64, arm64) o macOS (Apple silicon, Intel), Node.js 20 o más nuevo. Sin sudo, sin Docker.

```bash
git clone <este repositorio> free-orca && cd free-orca
bash install.sh
```

(`curl -fsSL https://make.operio.work/install.sh | bash` cuando se publique la primera versión.)

El instalador:

- descarga herdr **0.9.5** para tu plataforma y verifica su sha256 contra las sumas del script;
- instala el panel en `~/.local/share/free-orca` y `free-orca` en `~/.local/bin`;
- instala un servicio de usuario de systemd (Linux) o un agente de launchd (macOS) y lo inicia
  (`--no-service` escribe los archivos sin activarlos);
- apaga las revisiones de actualización en segundo plano de herdr en
  `~/.config/herdr/config.toml` (un bloque marcado que se quita al desinstalar). herdr queda
  fijado: usa `free-orca update`, no `herdr update`, para que herdr y el panel se muevan juntos.

Puedes correrlo de nuevo sin problema. Luego abre **http://127.0.0.1:7171**.

```
free-orca start | stop | restart | status | update | uninstall
```

## Úsalo desde tu teléfono

Free-ORCA solo escucha en `127.0.0.1`. Déjalo así y llega a él por una de estas vías:

- **Tailscale** (red privada, HTTPS): `tailscale serve --bg 7171`, luego pon el nombre que
  muestra en `~/.config/free-orca/env` como `FREE_ORCA_ALLOWED_HOSTS=<equipo>.<tailnet>.ts.net`
  y corre `free-orca restart`. Las alertas push necesitan HTTPS, así que esta es la vía para tenerlas.
- **Túnel SSH**: `ssh -N -L 7171:127.0.0.1:7171 tu@esta-computadora`, luego abre
  `http://127.0.0.1:7171` en el dispositivo donde corre el túnel.

Nunca lo expongas a internet: sin reenvío de puertos, sin Tailscale Funnel.

## Modelo de seguridad

Free-ORCA puede escribir en tus agentes y abrir terminales **con tu usuario**. No hay inicio de
sesión. Lo que lo protege es que solo tú puedes llegar a él:

- Escucha en `127.0.0.1`. `FREE_ORCA_HOST` lo cambia; el servidor muestra entonces una
  advertencia clara, y no deberías hacerlo en una red en la que no confíes por completo.
- Solo responde a `localhost`, `127.0.0.1`, `[::1]` y a los nombres de
  `FREE_ORCA_ALLOWED_HOSTS`; cualquier otro `Host` recibe `421`. Esto bloquea ataques de DNS rebinding.
- Toda petición que cambia algo necesita un encabezado `Origin` del mismo origen, lo que
  impide que otros sitios web le envíen peticiones (CSRF).
- Abrir o crear una terminal pide una confirmación primero, que dura 15 minutos.
- Ajustes, llaves VAPID, estado y registros viven en `~/.config/free-orca` con permisos solo
  para ti. Las instrucciones y respuestas de los agentes nunca se escriben en el registro.

Cualquiera con acceso a tu cuenta de usuario, o a un dispositivo desde el que abras el túnel, puede usarlo.

## Rutinas

Un paquete de rutina es una carpeta con un `routine.json` en `~/.config/free-orca/routines/<id>/`
(el formato está en el [README en inglés](README.md#routines)).

- `schedule` es una línea cron de 5 campos en la hora local de la computadora. El programador
  corre dentro de Free-ORCA; nunca se toca el crontab del sistema. Las ejecuciones perdidas
  mientras estaba detenido se saltan. En la pestaña **Rutinas** lo cambias con palabras simples
  (todos los días, lun–vie, lun–sáb, un día a la semana o cada hora, a una hora); la línea cron
  queda en **Avanzado** para todo lo demás.
  Si omites `schedule`, la rutina es **bajo pedido**: la pestaña la muestra como "Bajo pedido" y
  solo corre cuando pulsas **Ejecutar ahora**.
- Las rutinas con `approval: "draft"` escriben en `~/.config/free-orca/drafts/<id>/`, y el
  borrador espera en la pestaña **Rutinas** hasta que lo apruebes o rechaces. Aprobar solo lo
  marca como aprobado. Las de `"none"` escriben un reporte en `~/.config/free-orca/reports/<id>/`.
- `agent` es `claude`, `codex` u `opencode` (instalado y con sesión iniciada por ti).
- Cada ejecución abre un panel de agente en herdr, así que puedes verlo, responder sus
  preguntas (por ejemplo, permiso para escribir el archivo) o detenerlo como a cualquier agente.
- Cada ejecución queda registrada como líneas JSON (entrada, ruta de salida, estado) en
  `~/.config/free-orca/logs/routines.jsonl`.

Se incluyen cinco paquetes apagados. Leen los archivos que dejes en `~/free-orca-desk/` y nunca
le envían nada a tus clientes: hacen un reporte, o preparan un borrador y tú lo envías.

| Paquete | Se ejecuta | Resultado |
|---|---|---|
| Resumen matutino de recepción | lun–sáb 07:30 | reporte |
| Respuestas a reseñas | todos los días 09:00 | borradores de respuesta, tú los publicas |
| Reporte semanal para el dueño | lunes 08:00 | reporte |
| Paquete para día de visitas (inmobiliarias) | bajo pedido | reporte: ruta, fichas de propiedades, lista |
| Agradecimiento después de la visita + reseña | todos los días 18:00 | borradores con un enlace de WhatsApp que tocas para enviar |

La lista completa, con las rutinas que Operio opera por ti, está en `catalog/catalog.json`.

## Ajustes

`~/.config/free-orca/env`, un `CLAVE=valor` por línea: `FREE_ORCA_PORT` (7171),
`FREE_ORCA_HOST` (127.0.0.1), `FREE_ORCA_ALLOWED_HOSTS`, `FREE_ORCA_FOLDERS` (carpetas que se
ofrecen para agentes nuevos, por defecto `~`), `FREE_ORCA_SHELL_CONFIRM_MIN` (15).

## Demo

`free-orca demo` inicia un segundo panel en **http://127.0.0.1:7172** con dos negocios
ficticios, Harbor Street Bistro y Brightside Dental, que cambias arriba. Sus agentes siguen un
guion: cada uno trabaja, se detiene a preguntarte algo (responde con un toque o un mensaje y
las siguientes líneas cambian según tu respuesta), termina y vuelve a empezar. Sin gasto de API,
sin datos reales, y nunca toca herdr, tus agentes ni `~/.config/free-orca` (vive en
`~/.config/free-orca-demo`). La pestaña Rutinas trae paquetes de ejemplo, historial y un
borrador por aprobar para cada negocio.

```
free-orca demo              iniciarlo (los agentes empiezan desde el principio)
free-orca demo --reset      empezar de cero: también rutinas, borradores e historial
free-orca demo --speed 2    reproducir el guion al doble de velocidad
free-orca demo --lang es    la demo en español (agentes, rutinas y borradores; se queda hasta que la cambies)
free-orca demo --stop       detenerlo
```

Hay capturas en `demo/screenshots/` (en español: `demo/screenshots/es/`).

## Desinstalar

`free-orca uninstall` (agrega `--purge` para borrar también `~/.config/free-orca`). Nunca
detiene tu servidor de herdr ni tus agentes.

## ¿Prefieres que lo operen por ti?

Free-ORCA es la versión gratuita para hacerlo tú mismo. Si prefieres que Operio opere tu equipo
de operaciones con IA (WhatsApp, Perfil de Negocio de Google, rutinas bilingües, aprobaciones y
monitoreo), visita [make.operio.work](https://make.operio.work).

## Licencia

MIT, Copyright (c) 2026 Operio. herdr y los demás componentes conservan sus propias licencias;
ver `THIRD_PARTY_NOTICES.md`.
