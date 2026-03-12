// Mock AudioWorkletProcessor
class AudioWorkletProcessor {
    public port: any;
    constructor() {
        this.port = {
            onmessage: null,
            postMessage: jest.fn()
        };
    }
    process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>) {
        return true;
    }
}

(global as any).AudioWorkletProcessor = AudioWorkletProcessor;
(global as any).registerProcessor = jest.fn();
(global as any).sampleRate = 44100;
