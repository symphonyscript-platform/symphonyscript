import { createAudioBuffer } from '../buffer-utils';
import { EnvelopeModule, EnvelopeParam } from '../modules/envelope';

describe('envelope module', () => {
    test('attack reaches near 1 after enough samples', () => {
        const env = new EnvelopeModule(1, 100);
        env.setParameter(EnvelopeParam.ATTACK_SEC, 0.1);
        env.setParameter(EnvelopeParam.DECAY_SEC, 1);
        env.setParameter(EnvelopeParam.SUSTAIN_LEVEL, 1);
        env.setParameter(EnvelopeParam.GATE, 1);

        const out = createAudioBuffer(1, 12);
        env.process([], [out], 12);

        expect(out.data[9]).toBeGreaterThan(0.99);
        expect(out.data[9]).toBeLessThanOrEqual(1);
    });

    test('decay approaches sustain level', () => {
        const env = new EnvelopeModule(1, 100);
        env.setParameter(EnvelopeParam.ATTACK_SEC, 0);
        env.setParameter(EnvelopeParam.DECAY_SEC, 0.1);
        env.setParameter(EnvelopeParam.SUSTAIN_LEVEL, 0.3);
        env.setParameter(EnvelopeParam.GATE, 1);

        const out = createAudioBuffer(1, 14);
        env.process([], [out], 14);

        expect(out.data[13]).toBeGreaterThan(0.29);
        expect(out.data[13]).toBeLessThan(0.31);
    });

    test('sustain holds while gate stays on', () => {
        const env = new EnvelopeModule(1, 100);
        env.setParameter(EnvelopeParam.ATTACK_SEC, 0);
        env.setParameter(EnvelopeParam.DECAY_SEC, 0);
        env.setParameter(EnvelopeParam.SUSTAIN_LEVEL, 0.42);
        env.setParameter(EnvelopeParam.GATE, 1);

        const warmup = createAudioBuffer(1, 4);
        env.process([], [warmup], 4);

        const out = createAudioBuffer(1, 16);
        env.process([], [out], 16);

        for (let i = 0; i < 16; i += 1) {
            expect(out.data[i]).toBeCloseTo(0.42, 6);
        }
    });

    test('release goes to near zero when gate turns off', () => {
        const env = new EnvelopeModule(1, 100);
        env.setParameter(EnvelopeParam.ATTACK_SEC, 0);
        env.setParameter(EnvelopeParam.DECAY_SEC, 0);
        env.setParameter(EnvelopeParam.SUSTAIN_LEVEL, 1);
        env.setParameter(EnvelopeParam.RELEASE_SEC, 0.1);
        env.setParameter(EnvelopeParam.GATE, 1);

        const onOut = createAudioBuffer(1, 2);
        env.process([], [onOut], 2);

        env.setParameter(EnvelopeParam.GATE, 0);
        const offOut = createAudioBuffer(1, 12);
        env.process([], [offOut], 12);

        expect(offOut.data[11]).toBeLessThan(0.01);
    });

    test('zero times produce immediate transitions', () => {
        const env = new EnvelopeModule(1, 100);
        env.setParameter(EnvelopeParam.ATTACK_SEC, 0);
        env.setParameter(EnvelopeParam.DECAY_SEC, 0);
        env.setParameter(EnvelopeParam.RELEASE_SEC, 0);
        env.setParameter(EnvelopeParam.SUSTAIN_LEVEL, 0.25);

        env.setParameter(EnvelopeParam.GATE, 1);
        const onOut = createAudioBuffer(1, 1);
        env.process([], [onOut], 1);
        expect(onOut.data[0]).toBeCloseTo(0.25, 6);

        env.setParameter(EnvelopeParam.GATE, 0);
        const offOut = createAudioBuffer(1, 1);
        env.process([], [offOut], 1);
        expect(offOut.data[0]).toBe(0);
    });

    test('sanitizes parameters', () => {
        const env = new EnvelopeModule(1, 100);

        env.setParameter(EnvelopeParam.GATE, 0.6);
        expect(env.getParameter(EnvelopeParam.GATE)).toBe(1);
        env.setParameter(EnvelopeParam.GATE, Number.NaN);
        expect(env.getParameter(EnvelopeParam.GATE)).toBe(0);

        env.setParameter(EnvelopeParam.ATTACK_SEC, -1);
        env.setParameter(EnvelopeParam.DECAY_SEC, Number.POSITIVE_INFINITY);
        env.setParameter(EnvelopeParam.RELEASE_SEC, Number.NaN);
        expect(env.getParameter(EnvelopeParam.ATTACK_SEC)).toBe(0);
        expect(env.getParameter(EnvelopeParam.DECAY_SEC)).toBe(0);
        expect(env.getParameter(EnvelopeParam.RELEASE_SEC)).toBe(0);

        env.setParameter(EnvelopeParam.SUSTAIN_LEVEL, 2);
        expect(env.getParameter(EnvelopeParam.SUSTAIN_LEVEL)).toBe(1);
        env.setParameter(EnvelopeParam.SUSTAIN_LEVEL, -1);
        expect(env.getParameter(EnvelopeParam.SUSTAIN_LEVEL)).toBe(0);
    });
});
