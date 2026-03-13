import { createFMSynth } from '../fm';

const BLOCK_SIZE = 64;

function hasNonZeroSamples(data: Float32Array): boolean {
    for (let i = 0; i < data.length; i += 1) {
        if (Math.abs(data[i]) > 0) {
            return true;
        }
    }
    return false;
}

function isNearSilent(data: Float32Array, threshold = 1e-4): boolean {
    for (let i = 0; i < data.length; i += 1) {
        if (Math.abs(data[i]) > threshold) {
            return false;
        }
    }
    return true;
}

describe('createFMSynth', () => {
    test('returns BasicInstrument with expected name and maxVoices', () => {
        const synth = createFMSynth();
        expect(synth.name).toBe('FM Synth');
        expect(synth.maxVoices).toBe(8);
    });

    test('option overrides apply for name and maxVoices', () => {
        const synth = createFMSynth({ name: 'Custom FM', maxVoices: 4 });
        expect(synth.name).toBe('Custom FM');
        expect(synth.maxVoices).toBe(4);
    });

    test('noteOn + render produces non-zero output', () => {
        const synth = createFMSynth({ blockSize: BLOCK_SIZE });
        synth.noteOn(60, 1, 0, 0);

        const output = synth.render(BLOCK_SIZE);
        expect(hasNonZeroSamples(output.data)).toBe(true);
    });

    test('option overrides modulationIndex and modulatorRatio apply correctly', () => {
        const lowIndex = createFMSynth({
            blockSize: BLOCK_SIZE,
            modulationIndex: 0,
            modulatorRatio: 1,
        });
        const highIndex = createFMSynth({
            blockSize: BLOCK_SIZE,
            modulationIndex: 5,
            modulatorRatio: 3,
        });

        lowIndex.noteOn(60, 1, 0, 0);
        highIndex.noteOn(60, 1, 0, 0);

        const outLow = lowIndex.render(BLOCK_SIZE);
        const outHigh = highIndex.render(BLOCK_SIZE);

        expect(hasNonZeroSamples(outLow.data)).toBe(true);
        expect(hasNonZeroSamples(outHigh.data)).toBe(true);

        let different = false;
        for (let i = 0; i < BLOCK_SIZE; i += 1) {
            if (outLow.data[i] !== outHigh.data[i]) {
                different = true;
                break;
            }
        }
        expect(different).toBe(true);
    });

    test('noteOff + render eventually goes silent after release', () => {
        const synth = createFMSynth({
            blockSize: BLOCK_SIZE,
            releaseSec: 0.01,
        });
        synth.noteOn(60, 1, 0, 0);
        synth.render(BLOCK_SIZE);

        synth.noteOff(60, 0);

        let silent = false;
        for (let i = 0; i < 64; i += 1) {
            synth.render(BLOCK_SIZE);
            if (synth.getActiveVoiceCount() === 0) {
                const lastOutput = synth.render(BLOCK_SIZE);
                if (isNearSilent(lastOutput.data)) {
                    silent = true;
                    break;
                }
            }
        }
        expect(silent).toBe(true);
    });
});
