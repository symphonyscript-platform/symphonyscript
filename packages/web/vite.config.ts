import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
    plugins: [
        dts({
            rollupTypes: false, // Fix "Unable to follow symbol" error
            outDir: 'dist'
        })
    ],
    build: {
        lib: {
            entry: {
                index: resolve(__dirname, 'src/index.ts'),
                processor: resolve(__dirname, 'src/runtime/processor.ts')
            },
            formats: ['es']
        }
    }
});
