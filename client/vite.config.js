import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

/**
 * Keeps local dev ports configurable so separate worktrees can run together.
 * @param {{mode: string}} config Vite configuration context.
 * @return {import('vite').UserConfig} Vite configuration for the selected mode.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: Number(env.DEV_PORT || 5173),
      proxy: {
        '/api': env.API_PROXY_TARGET || 'http://localhost:3001',
      },
    },
  }
})
