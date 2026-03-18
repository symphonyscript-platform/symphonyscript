import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'SymphonyComposer',
      fileName: 'index'
    },
    rollupOptions: {
      external: [
        '@symphonyscript/core',
        '@symphonyscript/kernel',
        '@symphonyscript/theory',
        '@symphonyscript/theory-legacy',
        '@symphonyscript/synaptic',
      ],
    },
  },
  plugins: []
})
