import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Pure frontend app — no backend, no proxy.
// The browser calls DeepSeek directly (via LangChain JS) and persists data
// to localStorage as JSONL strings (exportable to real .jsonl files).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 7991,
  },
})
