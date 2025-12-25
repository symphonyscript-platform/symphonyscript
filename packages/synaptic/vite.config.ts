import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'SymphonySynaptic',
      fileName: 'index'
    },
    rollupOptions: {
      external: ['@symphonyscript/kernel', '@symphonyscript/theory']
    }
  },
  plugins: [],
})
