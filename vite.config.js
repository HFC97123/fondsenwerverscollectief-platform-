import { existsSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// De brontaal blijft app.html (nooit index.html) om nooit te botsen met de
// bestaande, goedgekeurde index.html in de repository-root. Deze plugin
// hernoemt uitsluitend het GEBOUWDE bestand in dist/ naar index.html, na
// afloop van het schrijven naar schijf (writeBundle) — dat is onafhankelijk
// van de interne volgorde waarin Vite zijn eigen HTML-plugin registreert, en
// dus betrouwbaarder dan het bundle-object tijdens generateBundle aanpassen.
function renameAppHtmlToIndex() {
  return {
    name: 'rename-app-html-to-index',
    apply: 'build',
    writeBundle(options) {
      const outDir = options.dir || 'dist';
      const from = resolve(outDir, 'app.html');
      const to = resolve(outDir, 'index.html');

      if (existsSync(from)) {
        renameSync(from, to);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), renameAppHtmlToIndex()],
  build: {
    outDir: 'dist',
    // app.html blijft de brontaal (zie toelichting hierboven); de plugin
    // hierboven zorgt dat dist/index.html het resultaat is.
    rollupOptions: {
      input: 'app.html',
    },
  },
});
