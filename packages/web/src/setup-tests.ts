const globalScope = globalThis as Record<string, unknown>;

if (typeof globalScope.AudioWorkletProcessor !== 'function') {
    class AudioWorkletProcessorShim {
        public readonly port = {
            onmessage: null as ((event: { data: unknown }) => void) | null,
            postMessage: (_message: unknown): void => {},
        };
    }

    globalScope.AudioWorkletProcessor = AudioWorkletProcessorShim;
}

if (typeof globalScope.registerProcessor !== 'function') {
    globalScope.registerProcessor = (_name: string, _processor: unknown): void => {};
}
