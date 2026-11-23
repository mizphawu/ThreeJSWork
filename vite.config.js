import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(projectRoot, 'index.html'),
        admin: resolve(projectRoot, 'admin.html'),
        matches: resolve(projectRoot, 'matches.html'),
        players: resolve(projectRoot, 'players.html'),
        matchParticipants: resolve(projectRoot, 'match-participants.html')
      }
    }
  }
});
