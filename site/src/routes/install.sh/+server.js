// /install.sh is the repository's install.sh, copied at build time (never edited here).
import installer from '../../../../install.sh?raw';

export const prerender = true;

export function GET() {
  return new Response(installer, {
    headers: { 'content-type': 'text/plain; charset=utf-8' }
  });
}
