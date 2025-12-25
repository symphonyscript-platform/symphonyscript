import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'SymphonyComposer',
      fileName: 'index'
    },
    rollupOptions: {
      // Ensure we don't bundle external dependencies
      external: ['@symphonyscript/kernel']
    }
  },
  plugins: []
})
