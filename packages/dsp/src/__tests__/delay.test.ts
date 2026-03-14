import { createAudioBuffer } from '../buffer-utils';
import { DelayModule, DelayParam } from '../modules/delay';

describe('delay module', () => {
    test('delay=1 produces one-sample lag, not immediate passthrough', () => {
        const sampleRate = 48000;
        const maxDelaySeconds = 0.1;
        const delay = new DelayModule(1, sampleRate, maxDelaySeconds);
        delay.setParameter(DelayParam.DELAY_TIME_SAMPLES, 1);
        delay.setParameter(DelayParam.FEEDBACK, 0);
        delay.setParameter(DelayParam.MIX, 1);

        const blockSize = 8;
        const input = createAudioBuffer(1, blockSize);
        input.data.fill(0);
        input.data[0] = 1;

        const out = createAudioBuffer(1, blockSize);
        delay.process([input], [out], blockSize);

        expect(out.data[0]).toBe(0);
        expect(out.data[1]).toBeCloseTo(1, 5);
        expect(out.data[2]).toBe(0);
    });

    test('delayed signal appears after correct number of samples', () => {
        const sampleRate = 48000;
        const maxDelaySeconds = 0.5;
        const delaySamples = 10;
        const delay = new DelayModule(1, sampleRate, maxDelaySeconds);
        delay.setParameter(DelayParam.DELAY_TIME_SAMPLES, delaySamples);
        delay.setParameter(DelayParam.FEEDBACK, 0);
        delay.setParameter(DelayParam.MIX, 1);

        const blockSize = 32;
        const input = createAudioBuffer(1, blockSize);
        input.data.fill(0);
        input.data[0] = 1;

        const out = createAudioBuffer(1, blockSize);
        delay.process([input], [out], blockSize);

        expect(out.data[0]).toBe(0);
        expect(out.data[delaySamples]).toBeCloseTo(1, 5);
        expect(out.data[delaySamples + 1]).toBe(0);
    });

    test('feedback produces decaying repetitions', () => {
        const sampleRate = 48000;
        const maxDelaySeconds = 0.5;
        const delaySamples = 8;
        const delay = new DelayModule(1, sampleRate, maxDelaySeconds);
        delay.setParameter(DelayParam.DELAY_TIME_SAMPLES, delaySamples);
        delay.setParameter(DelayParam.FEEDBACK, 0.5);
        delay.setParameter(DelayParam.MIX, 1);

        const blockSize = 64;
        const input = createAudioBuffer(1, blockSize);
        input.data.fill(0);
        input.data[0] = 1;

        const out = createAudioBuffer(1, blockSize);
        delay.process([input], [out], blockSize);

        const firstEcho = out.data[delaySamples];
        const secondEcho = out.data[delaySamples * 2];
        const thirdEcho = out.data[delaySamples * 3];

        expect(firstEcho).toBeCloseTo(1, 4);
        expect(secondEcho).toBeCloseTo(0.5, 3);
        expect(thirdEcho).toBeCloseTo(0.25, 3);
    });

    test('mix=0 passes dry signal only', () => {
        const sampleRate = 48000;
        const maxDelaySeconds = 0.1;
        const delay = new DelayModule(1, sampleRate, maxDelaySeconds);
        delay.setParameter(DelayParam.DELAY_TIME_SAMPLES, 5);
        delay.setParameter(DelayParam.FEEDBACK, 0.5);
        delay.setParameter(DelayParam.MIX, 0);

        const blockSize = 32;
        const input = createAudioBuffer(1, blockSize);
        for (let i = 0; i < blockSize; i += 1) {
            input.data[i] = i * 0.1;
        }

        const out = createAudioBuffer(1, blockSize);
        delay.process([input], [out], blockSize);

        for (let i = 0; i < blockSize; i += 1) {
            expect(out.data[i]).toBeCloseTo(input.data[i], 8);
        }
    });

    test('mix=1 passes wet signal only', () => {
        const sampleRate = 48000;
        const maxDelaySeconds = 0.1;
        const delaySamples = 4;
        const delay = new DelayModule(1, sampleRate, maxDelaySeconds);
        delay.setParameter(DelayParam.DELAY_TIME_SAMPLES, delaySamples);
        delay.setParameter(DelayParam.FEEDBACK, 0);
        delay.setParameter(DelayParam.MIX, 1);

        const blockSize = 32;
        const input = createAudioBuffer(1, blockSize);
        input.data.fill(0);
        input.data[0] = 1;

        const out = createAudioBuffer(1, blockSize);
        delay.process([input], [out], blockSize);

        for (let i = 0; i < delaySamples; i += 1) {
            expect(out.data[i]).toBe(0);
        }
        expect(out.data[delaySamples]).toBeCloseTo(1, 5);
    });

    test('reset clears delay line', () => {
        const sampleRate = 48000;
        const maxDelaySeconds = 0.1;
        const delaySamples = 4;
        const delay = new DelayModule(1, sampleRate, maxDelaySeconds);
        delay.setParameter(DelayParam.DELAY_TIME_SAMPLES, delaySamples);
        delay.setParameter(DelayParam.FEEDBACK, 0.5);
        delay.setParameter(DelayParam.MIX, 1);

        const blockSize = 16;
        const input = createAudioBuffer(1, blockSize);
        input.data.fill(0);
        input.data[0] = 1;

        const out1 = createAudioBuffer(1, blockSize);
        delay.process([input], [out1], blockSize);

        delay.reset();

        const input2 = createAudioBuffer(1, blockSize);
        input2.data.fill(0);

        const out2 = createAudioBuffer(1, blockSize);
        delay.process([input2], [out2], blockSize);

        for (let i = 0; i < blockSize; i += 1) {
            expect(out2.data[i]).toBe(0);
        }
    });
});
