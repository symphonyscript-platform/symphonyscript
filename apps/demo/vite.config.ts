import { defineConfig } from 'vite';
import { resolve } from 'path';

const packagesDir = resolve(__dirname, '../../packages');

export default defineConfig({
    resolve: {
        alias: [
            // More specific subpath first (before @symphonyscript/web)
            { find: '@symphonyscript/web/processor', replacement: resolve(packagesDir, 'web/src/runtime/processor.ts') },
            { find: '@symphonyscript/composer', replacement: resolve(packagesDir, 'composer/src/index.ts') },
            { find: '@symphonyscript/core', replacement: resolve(packagesDir, 'core/src/index.ts') },
            { find: '@symphonyscript/dsp', replacement: resolve(packagesDir, 'dsp/src/index.ts') },
            { find: '@symphonyscript/kernel', replacement: resolve(packagesDir, 'kernel/src/index.ts') },
            { find: '@symphonyscript/synthesis', replacement: resolve(packagesDir, 'synthesis/src/index.ts') },
            { find: '@symphonyscript/synaptic', replacement: resolve(packagesDir, 'synaptic/src/index.ts') },
            { find: '@symphonyscript/theory', replacement: resolve(packagesDir, 'theory/src/index.ts') },
            { find: '@symphonyscript/theory-legacy', replacement: resolve(packagesDir, 'theory-legacy/src/index.ts') },
            { find: '@symphonyscript/web', replacement: resolve(packagesDir, 'web/src/index.ts') },
        ],
    },
    optimizeDeps: {
        force: true,
    },
    build: {
        rollupOptions: {
            input: 'index.html',
        },
    },
    server: {
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp',
        }
    },
    worker: {
        format: 'es',
    }
});
