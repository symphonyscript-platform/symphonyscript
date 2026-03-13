import { createAudioBuffer } from '../buffer-utils';
import {
    OscillatorModule,
    OscillatorParam,
    OscillatorWaveform,
} from '../modules/oscillator';

describe('oscillator module', () => {
    test('produces non-zero output for sine at 440Hz', () => {
        const osc = new OscillatorModule(1, 48000);
        osc.setParameter(OscillatorParam.FREQUENCY, 440);
        osc.setParameter(OscillatorParam.WAVEFORM, OscillatorWaveform.SINE);

        const out = createAudioBuffer(1, 64);
        osc.process([], [out], 64);

        let hasNonZero = false;
        for (let i = 0; i < 64; i += 1) {
            if (out.data[i] !== 0) {
                hasNonZero = true;
                break;
            }
        }

        expect(hasNonZero).toBe(true);
    });

    test('is deterministic across fresh oscillators with same parameters', () => {
        const a = new OscillatorModule(1, 48000);
        const b = new OscillatorModule(2, 48000);

        a.setParameter(OscillatorParam.FREQUENCY, 220);
        b.setParameter(OscillatorParam.FREQUENCY, 220);
        a.setParameter(OscillatorParam.DETUNE_CENTS, -10);
        b.setParameter(OscillatorParam.DETUNE_CENTS, -10);
        a.setParameter(OscillatorParam.WAVEFORM, OscillatorWaveform.TRIANGLE);
        b.setParameter(OscillatorParam.WAVEFORM, OscillatorWaveform.TRIANGLE);

        const outA = createAudioBuffer(1, 128);
        const outB = createAudioBuffer(1, 128);
        a.process([], [outA], 128);
        b.process([], [outB], 128);

        expect(Array.from(outA.data)).toEqual(Array.from(outB.data));
    });

    test('keeps phase continuity across process calls', () => {
        const osc = new OscillatorModule(1, 48000);
        osc.setParameter(OscillatorParam.FREQUENCY, 440);
        osc.setParameter(OscillatorParam.WAVEFORM, OscillatorWaveform.SINE);

        const first = createAudioBuffer(1, 64);
        const second = createAudioBuffer(1, 64);
        osc.process([], [first], 64);
        osc.process([], [second], 64);

        expect(Array.from(second.data)).not.toEqual(Array.from(first.data));
    });

    test('square waveform respects duty cycle from pulse width', () => {
        const osc = new OscillatorModule(1, 100);
        osc.setParameter(OscillatorParam.FREQUENCY, 1);
        osc.setParameter(OscillatorParam.WAVEFORM, OscillatorWaveform.SQUARE);
        osc.setParameter(OscillatorParam.PULSE_WIDTH, 0.25);

        const out = createAudioBuffer(1, 100);
        osc.process([], [out], 100);

        let positive = 0;
        let negative = 0;
        for (let i = 0; i < 100; i += 1) {
            if (out.data[i] > 0) {
                positive += 1;
            } else if (out.data[i] < 0) {
                negative += 1;
            }
        }

        expect(positive).toBe(25);
        expect(negative).toBe(75);
    });

    test('FM input applies phase modulation when modulationIndex > 0', () => {
        const modulator = new OscillatorModule(1, 48000);
        modulator.setParameter(OscillatorParam.FREQUENCY, 220);
        modulator.setParameter(OscillatorParam.WAVEFORM, OscillatorWaveform.SINE);

        const carrier = new OscillatorModule(2, 48000);
        carrier.setParameter(OscillatorParam.FREQUENCY, 440);
        carrier.setParameter(OscillatorParam.WAVEFORM, OscillatorWaveform.SINE);
        carrier.setParameter(OscillatorParam.MODULATION_INDEX, 3);
        carrier.setParameter(OscillatorParam.MODULATOR_RATIO, 1);

        const modOut = createAudioBuffer(1, 64);
        modulator.process([], [modOut], 64);

        const carrierOut = createAudioBuffer(1, 64);
        carrier.process([modOut], [carrierOut], 64);

        let hasNonZero = false;
        for (let i = 0; i < 64; i += 1) {
            if (carrierOut.data[i] !== 0) {
                hasNonZero = true;
                break;
            }
        }
        expect(hasNonZero).toBe(true);

        const carrierPlain = createAudioBuffer(1, 64);
        carrier.setParameter(OscillatorParam.MODULATION_INDEX, 0);
        carrier.reset();
        carrier.process([], [carrierPlain], 64);

        let different = false;
        for (let i = 0; i < 64; i += 1) {
            if (carrierOut.data[i] !== carrierPlain.data[i]) {
                different = true;
                break;
            }
        }
        expect(different).toBe(true);
    });

    test('MODULATION_INDEX and MODULATOR_RATIO are sanitized', () => {
        const osc = new OscillatorModule(1, 48000);
        osc.setParameter(OscillatorParam.MODULATION_INDEX, -1);
        osc.setParameter(OscillatorParam.MODULATOR_RATIO, 0);

        expect(osc.getParameter(OscillatorParam.MODULATION_INDEX)).toBe(0);
        expect(osc.getParameter(OscillatorParam.MODULATOR_RATIO)).toBe(1);
    });

    test('invalid params are sanitized and process does not throw', () => {
        const osc = new OscillatorModule(1, 48000);
        osc.setParameter(OscillatorParam.FREQUENCY, -123);
        osc.setParameter(OscillatorParam.DETUNE_CENTS, Number.NaN);
        osc.setParameter(OscillatorParam.WAVEFORM, 999);
        osc.setParameter(OscillatorParam.PULSE_WIDTH, 2);

        const out = createAudioBuffer(1, 32);

        expect(() => osc.process([], [out], 32)).not.toThrow();
        expect(osc.getParameter(OscillatorParam.FREQUENCY)).toBeGreaterThan(0);
        expect(osc.getParameter(OscillatorParam.DETUNE_CENTS)).toBe(0);
        expect(osc.getParameter(OscillatorParam.WAVEFORM)).toBe(
            OscillatorWaveform.TRIANGLE
        );

        const pulseWidth = osc.getParameter(OscillatorParam.PULSE_WIDTH);
        expect(pulseWidth).toBeGreaterThan(0);
        expect(pulseWidth).toBeLessThan(1);
    });
});
