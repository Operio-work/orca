import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-static';
import { defineConfig } from 'vite';

// SvelteKit 3: the Kit options live in the plugin call, not in svelte.config.js.
export default defineConfig({
  plugins: [
    sveltekit({
      adapter: adapter({ pages: 'build', assets: 'build', strict: true }),
      prerender: {
        // Every page is linked from the home pages; a broken link fails the build.
        entries: ['*', '/es', '/404', '/install.sh', '/sitemap.xml', '/robots.txt'],
        handleHttpError: 'fail',
        handleMissingId: 'fail'
      }
    })
  ],
  // catalog.json and install.sh live one level up, in the Free-ORCA repo.
  server: { fs: { allow: ['..'] } }
});
