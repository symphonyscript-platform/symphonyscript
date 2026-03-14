import { createAudioBuffer } from '../buffer-utils';
import { ReverbModule, ReverbParam } from '../modules/reverb';

describe('reverb module', () => {
    const sampleRate = 48000;
    const blockSize = 64;

    test('non-zero input produces non-zero output', () => {
        const reverb = new ReverbModule(1, sampleRate);
        reverb.setParameter(ReverbParam.MIX, 1);

        const input = createAudioBuffer(1, blockSize);
        input.data.fill(0);
        input.data[0] = 1;

        const out = createAudioBuffer(1, blockSize);
        const minCombDelay = 1422;
        const blocksToRun = Math.ceil(minCombDelay / blockSize) + 1;
        for (let b = 0; b < blocksToRun; b += 1) {
            reverb.process([input], [out], blockSize);
            if (b === 0) {
                input.data[0] = 0;
            }
        }

        let hasNonZero = false;
        for (let i = 0; i < blockSize; i += 1) {
            if (out.data[i] !== 0) {
                hasNonZero = true;
                break;
            }
        }
        expect(hasNonZero).toBe(true);
    });

    test('output continues after input goes silent (tail)', () => {
        const reverb = new ReverbModule(1, sampleRate);
        reverb.setParameter(ReverbParam.ROOM_SIZE, 0.8);
        reverb.setParameter(ReverbParam.MIX, 1);

        const inputWithSignal = createAudioBuffer(1, blockSize);
        inputWithSignal.data.fill(0);
        inputWithSignal.data[0] = 1;

        const inputSilent = createAudioBuffer(1, blockSize);
        inputSilent.data.fill(0);

        const minCombDelay = 1422;
        const blocksToFill = Math.ceil(minCombDelay / blockSize) + 1;

        reverb.process([inputWithSignal], [createAudioBuffer(1, blockSize)], blockSize);
        for (let b = 1; b < blocksToFill; b += 1) {
            inputWithSignal.data[0] = 0;
            reverb.process([inputWithSignal], [createAudioBuffer(1, blockSize)], blockSize);
        }

        const out2 = createAudioBuffer(1, blockSize);
        reverb.process([inputSilent], [out2], blockSize);

        let hasNonZeroInTail = false;
        for (let i = 0; i < blockSize; i += 1) {
            if (out2.data[i] !== 0) {
                hasNonZeroInTail = true;
                break;
            }
        }
        expect(hasNonZeroInTail).toBe(true);
    });

    test('mix=0 passes dry signal', () => {
        const reverb = new ReverbModule(1, sampleRate);
        reverb.setParameter(ReverbParam.MIX, 0);

        const input = createAudioBuffer(1, blockSize);
        for (let i = 0; i < blockSize; i += 1) {
            input.data[i] = i * 0.01;
        }

        const out = createAudioBuffer(1, blockSize);
        reverb.process([input], [out], blockSize);

        for (let i = 0; i < blockSize; i += 1) {
            expect(out.data[i]).toBeCloseTo(input.data[i], 8);
        }
    });

    test('reset produces silence after input stops', () => {
        const reverb = new ReverbModule(1, sampleRate);
        reverb.setParameter(ReverbParam.ROOM_SIZE, 0.8);
        reverb.setParameter(ReverbParam.MIX, 1);

        const inputWithSignal = createAudioBuffer(1, blockSize);
        inputWithSignal.data.fill(0);
        inputWithSignal.data[0] = 1;

        const inputSilent = createAudioBuffer(1, blockSize);
        inputSilent.data.fill(0);

        reverb.process([inputWithSignal], [createAudioBuffer(1, blockSize)], blockSize);
        reverb.reset();
        reverb.process([inputSilent], [createAudioBuffer(1, blockSize)], blockSize);

        const outAfterReset = createAudioBuffer(1, blockSize);
        reverb.process([inputSilent], [outAfterReset], blockSize);

        for (let i = 0; i < blockSize; i += 1) {
            expect(outAfterReset.data[i]).toBeCloseTo(0, 10);
        }
    });
});
