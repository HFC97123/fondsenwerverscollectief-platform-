import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    // De React-app is nog niet de gepubliceerde site; app.html is de ingang.
    rollupOptions: {
      input: 'app.html',
    },
  },
});
