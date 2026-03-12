import { createAudioBuffer } from '../buffer-utils';
import { LFOModule, LFOParam, LFOWaveform } from '../modules/lfo';

describe('lfo module', () => {
    test('produces non-zero output for sine with positive depth', () => {
        const lfo = new LFOModule(1, 48000);
        lfo.setParameter(LFOParam.RATE_HZ, 5);
        lfo.setParameter(LFOParam.DEPTH, 0.8);
        lfo.setParameter(LFOParam.WAVEFORM, LFOWaveform.SINE);

        const out = createAudioBuffer(1, 256);
        lfo.process([], [out], 256);

        let hasNonZero = false;
        for (let i = 0; i < 256; i += 1) {
            if (out.data[i] !== 0) {
                hasNonZero = true;
                break;
            }
        }
        expect(hasNonZero).toBe(true);
    });

    test('is deterministic across fresh instances with same params', () => {
        const a = new LFOModule(1, 48000);
        const b = new LFOModule(2, 48000);

        a.setParameter(LFOParam.RATE_HZ, 3.5);
        b.setParameter(LFOParam.RATE_HZ, 3.5);
        a.setParameter(LFOParam.DEPTH, 0.4);
        b.setParameter(LFOParam.DEPTH, 0.4);
        a.setParameter(LFOParam.WAVEFORM, LFOWaveform.TRIANGLE);
        b.setParameter(LFOParam.WAVEFORM, LFOWaveform.TRIANGLE);
        a.setParameter(LFOParam.PHASE_OFFSET, 0.7);
        b.setParameter(LFOParam.PHASE_OFFSET, 0.7);

        const outA = createAudioBuffer(1, 128);
        const outB = createAudioBuffer(1, 128);
        a.process([], [outA], 128);
        b.process([], [outB], 128);

        expect(Array.from(outA.data)).toEqual(Array.from(outB.data));
    });

    test('keeps phase continuity across process calls', () => {
        const lfo = new LFOModule(1, 48000);
        lfo.setParameter(LFOParam.RATE_HZ, 2);
        lfo.setParameter(LFOParam.DEPTH, 1);
        lfo.setParameter(LFOParam.WAVEFORM, LFOWaveform.SINE);

        const first = createAudioBuffer(1, 64);
        const second = createAudioBuffer(1, 64);
        lfo.process([], [first], 64);
        lfo.process([], [second], 64);

        expect(Array.from(second.data)).not.toEqual(Array.from(first.data));
    });

    test('square wave produces +/- depth levels', () => {
        const lfo = new LFOModule(1, 100);
        lfo.setParameter(LFOParam.RATE_HZ, 1);
        lfo.setParameter(LFOParam.DEPTH, 0.5);
        lfo.setParameter(LFOParam.WAVEFORM, LFOWaveform.SQUARE);

        const out = createAudioBuffer(1, 100);
        lfo.process([], [out], 100);

        let hasPositiveDepth = false;
        let hasNegativeDepth = false;
        for (let i = 0; i < 100; i += 1) {
            if (out.data[i] === 0.5) {
                hasPositiveDepth = true;
            } else if (out.data[i] === -0.5) {
                hasNegativeDepth = true;
            } else {
                expect(Math.abs(out.data[i])).toBeCloseTo(0.5, 6);
            }
        }

        expect(hasPositiveDepth).toBe(true);
        expect(hasNegativeDepth).toBe(true);
    });

    test('invalid params sanitized and process does not throw', () => {
        const lfo = new LFOModule(1, 48000);
        lfo.setParameter(LFOParam.RATE_HZ, Number.NaN);
        lfo.setParameter(LFOParam.DEPTH, -2);
        lfo.setParameter(LFOParam.WAVEFORM, 99);
        lfo.setParameter(LFOParam.PHASE_OFFSET, Number.POSITIVE_INFINITY);

        const out = createAudioBuffer(1, 64);
        expect(() => lfo.process([], [out], 64)).not.toThrow();

        expect(lfo.getParameter(LFOParam.RATE_HZ)).toBe(0);
        expect(lfo.getParameter(LFOParam.DEPTH)).toBe(0);
        expect(lfo.getParameter(LFOParam.WAVEFORM)).toBe(LFOWaveform.TRIANGLE);
        expect(lfo.getParameter(LFOParam.PHASE_OFFSET)).toBe(0);
    });
});
