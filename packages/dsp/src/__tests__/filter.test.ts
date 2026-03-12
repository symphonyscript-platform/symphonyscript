import { createAudioBuffer } from '../buffer-utils';
import {
    FilterModule,
    FilterParam,
    FilterType,
} from '../modules/filter';

describe('filter module', () => {
    test('lowpass attenuates high-frequency alternating input significantly', () => {
        const filter = new FilterModule(1, 48000);
        filter.setParameter(FilterParam.FILTER_TYPE, FilterType.LOWPASS);
        filter.setParameter(FilterParam.CUTOFF, 200);
        filter.setParameter(FilterParam.RESONANCE, 0);

        const input = createAudioBuffer(1, 512);
        for (let i = 0; i < 512; i += 1) {
            input.data[i] = i % 2 === 0 ? 1 : -1;
        }

        const out = createAudioBuffer(1, 512);
        filter.process([input], [out], 512);

        let inAbsSum = 0;
        let outAbsSum = 0;
        for (let i = 0; i < 512; i += 1) {
            inAbsSum += Math.abs(input.data[i]);
            outAbsSum += Math.abs(out.data[i]);
        }

        expect(outAbsSum).toBeLessThan(inAbsSum * 0.2);
    });

    test('highpass attenuates DC/slow component', () => {
        const filter = new FilterModule(1, 48000);
        filter.setParameter(FilterParam.FILTER_TYPE, FilterType.HIGHPASS);
        filter.setParameter(FilterParam.CUTOFF, 300);
        filter.setParameter(FilterParam.RESONANCE, 0);

        const input = createAudioBuffer(1, 256);
        input.data.fill(0.75);
        const warmupOut = createAudioBuffer(1, 256);
        filter.process([input], [warmupOut], 256);

        const out = createAudioBuffer(1, 256);
        filter.process([input], [out], 256);

        let meanAbs = 0;
        for (let i = 0; i < 256; i += 1) {
            meanAbs += Math.abs(out.data[i]);
        }
        meanAbs /= 256;

        expect(meanAbs).toBeLessThan(0.05);
    });

    test('bandpass produces finite non-NaN output and responds to cutoff', () => {
        const sampleRate = 48000;
        const blockSize = 1024;
        const frequency = 1000;
        const input = createAudioBuffer(1, blockSize);
        for (let i = 0; i < blockSize; i += 1) {
            input.data[i] = Math.sin((2 * Math.PI * frequency * i) / sampleRate);
        }

        const lowCutoff = new FilterModule(1, sampleRate);
        lowCutoff.setParameter(FilterParam.FILTER_TYPE, FilterType.BANDPASS);
        lowCutoff.setParameter(FilterParam.CUTOFF, 150);
        const lowOut = createAudioBuffer(1, blockSize);
        lowCutoff.process([input], [lowOut], blockSize);

        const nearCutoff = new FilterModule(2, sampleRate);
        nearCutoff.setParameter(FilterParam.FILTER_TYPE, FilterType.BANDPASS);
        nearCutoff.setParameter(FilterParam.CUTOFF, 1000);
        const nearOut = createAudioBuffer(1, blockSize);
        nearCutoff.process([input], [nearOut], blockSize);

        let lowEnergy = 0;
        let nearEnergy = 0;
        for (let i = 0; i < blockSize; i += 1) {
            const a = lowOut.data[i];
            const b = nearOut.data[i];
            expect(Number.isFinite(a)).toBe(true);
            expect(Number.isNaN(a)).toBe(false);
            expect(Number.isFinite(b)).toBe(true);
            expect(Number.isNaN(b)).toBe(false);
            lowEnergy += Math.abs(a);
            nearEnergy += Math.abs(b);
        }

        expect(nearEnergy).toBeGreaterThan(lowEnergy * 1.5);
    });

    test('invalid params sanitized and process does not throw', () => {
        const filter = new FilterModule(1, 48000);
        filter.setParameter(FilterParam.CUTOFF, Number.NaN);
        filter.setParameter(FilterParam.RESONANCE, -2);
        filter.setParameter(FilterParam.FILTER_TYPE, 99);

        const input = createAudioBuffer(1, 64);
        input.data.fill(1);
        const control = createAudioBuffer(1, 64);
        control.data.fill(Number.NaN);
        const out = createAudioBuffer(1, 64);

        expect(() => filter.process([input, control], [out], 64)).not.toThrow();
        expect(filter.getParameter(FilterParam.CUTOFF)).toBeGreaterThan(0);
        expect(filter.getParameter(FilterParam.CUTOFF)).toBeLessThan(24000);
        expect(filter.getParameter(FilterParam.RESONANCE)).toBe(0);
        expect(filter.getParameter(FilterParam.FILTER_TYPE)).toBe(
            FilterType.BANDPASS
        );
    });
});
