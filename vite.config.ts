import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ command }) => ({
  // rutas relativas en el build: funciona igual en usuario.github.io/libritos/ que en un dominio propio
  base: command === 'build' ? './' : '/',
  plugins: [react(), tailwindcss()],
  worker: { format: 'es' },
}));
