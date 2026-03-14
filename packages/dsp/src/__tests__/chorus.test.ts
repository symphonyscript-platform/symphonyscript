import { createAudioBuffer } from '../buffer-utils';
import { ChorusModule, ChorusParam } from '../modules/chorus';

describe('chorus module', () => {
    const sampleRate = 48000;
    const blockSize = 64;

    test('non-zero input produces non-zero output', () => {
        const chorus = new ChorusModule(1, sampleRate);
        chorus.setParameter(ChorusParam.MIX, 1);

        const input = createAudioBuffer(1, blockSize);
        input.data.fill(0);
        input.data[0] = 1;

        const baseDelaySamples = Math.ceil(0.007 * sampleRate);
        const blocksToRun = Math.ceil(baseDelaySamples / blockSize) + 2;
        let hasNonZero = false;
        for (let b = 0; b < blocksToRun; b += 1) {
            const out = createAudioBuffer(1, blockSize);
            chorus.process([input], [out], blockSize);
            if (b === 0) {
                input.data[0] = 0;
            }
            for (let i = 0; i < blockSize; i += 1) {
                if (out.data[i] !== 0) {
                    hasNonZero = true;
                    break;
                }
            }
            if (hasNonZero) break;
        }
        expect(hasNonZero).toBe(true);
    });

    test('mix=0 passes dry signal only', () => {
        const chorus = new ChorusModule(1, sampleRate);
        chorus.setParameter(ChorusParam.MIX, 0);

        const input = createAudioBuffer(1, blockSize);
        for (let i = 0; i < blockSize; i += 1) {
            input.data[i] = i * 0.01;
        }

        const out = createAudioBuffer(1, blockSize);
        chorus.process([input], [out], blockSize);

        for (let i = 0; i < blockSize; i += 1) {
            expect(out.data[i]).toBeCloseTo(input.data[i], 8);
        }
    });

    test('output differs from dry input when mix=1', () => {
        const chorus = new ChorusModule(1, sampleRate);
        chorus.setParameter(ChorusParam.RATE_HZ, 0.5);
        chorus.setParameter(ChorusParam.DEPTH, 0.5);
        chorus.setParameter(ChorusParam.MIX, 1);

        const input = createAudioBuffer(1, blockSize);
        for (let i = 0; i < blockSize; i += 1) {
            input.data[i] = Math.sin((i / blockSize) * Math.PI * 4) * 0.5;
        }

        const baseDelaySamples = Math.ceil(0.007 * sampleRate);
        const blocksToWarmUp = Math.ceil(baseDelaySamples / blockSize) + 2;

        for (let b = 0; b < blocksToWarmUp; b += 1) {
            chorus.process([input], [createAudioBuffer(1, blockSize)], blockSize);
        }

        const out = createAudioBuffer(1, blockSize);
        chorus.process([input], [out], blockSize);

        let differsFromDry = false;
        for (let i = 0; i < blockSize; i += 1) {
            if (Math.abs(out.data[i] - input.data[i]) > 0.001) {
                differsFromDry = true;
                break;
            }
        }
        expect(differsFromDry).toBe(true);
    });

    test('reset produces silence after input stops', () => {
        const chorus = new ChorusModule(1, sampleRate);
        chorus.setParameter(ChorusParam.RATE_HZ, 0.5);
        chorus.setParameter(ChorusParam.DEPTH, 0.5);
        chorus.setParameter(ChorusParam.MIX, 1);

        const inputWithSignal = createAudioBuffer(1, blockSize);
        inputWithSignal.data.fill(0);
        inputWithSignal.data[0] = 1;

        const inputSilent = createAudioBuffer(1, blockSize);
        inputSilent.data.fill(0);

        const baseDelaySamples = Math.ceil(0.007 * sampleRate);
        const blocksToFill = Math.ceil(baseDelaySamples / blockSize) + 1;

        for (let b = 0; b < blocksToFill; b += 1) {
            chorus.process(
                [inputWithSignal],
                [createAudioBuffer(1, blockSize)],
                blockSize
            );
            if (b === 0) {
                inputWithSignal.data[0] = 0;
            }
        }

        chorus.reset();
        chorus.process(
            [inputSilent],
            [createAudioBuffer(1, blockSize)],
            blockSize
        );

        const outAfterReset = createAudioBuffer(1, blockSize);
        chorus.process([inputSilent], [outAfterReset], blockSize);

        for (let i = 0; i < blockSize; i += 1) {
            expect(outAfterReset.data[i]).toBeCloseTo(0, 10);
        }
    });
});
