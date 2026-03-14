/**
 * Demo AudioWorklet entry.
 * Sets engine factory before registering the processor.
 */
import { BasicEngine, BasicMixer } from '@symphonyscript/dsp';
import { createSubtractiveInstrument } from '@symphonyscript/synthesis';
import '@symphonyscript/web/processor';

const BLOCK_SIZE = 128;

function createEngine(sampleRate: number, blockSize: number): BasicEngine {
    const instrument = createSubtractiveInstrument({ sampleRate, blockSize });
    const channel = {
        instrument,
        volume: 0.5,
        pan: 0,
        muted: false,
        sendLevels: new Float32Array(0),
    };
    const mixer = new BasicMixer(2, [channel], [], blockSize);
    return new BasicEngine(mixer, sampleRate, blockSize);
}

(globalThis as unknown as { __SYMPHONYSCRIPT_ENGINE_FACTORY__?: (sr: number, bs: number) => unknown }).__SYMPHONYSCRIPT_ENGINE_FACTORY__ =
    createEngine;
