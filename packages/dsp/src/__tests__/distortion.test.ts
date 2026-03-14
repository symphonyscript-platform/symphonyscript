import { createAudioBuffer } from '../buffer-utils';
import { DistortionModule, DistortionParam } from '../modules/distortion';

describe('distortion module', () => {
    test('drive=1 produces near-unity output (input ≈ output)', () => {
        const dist = new DistortionModule(1);
        dist.setParameter(DistortionParam.DRIVE, 1);
        dist.setParameter(DistortionParam.MIX, 1);

        const input = createAudioBuffer(1, 4);
        input.data[0] = 0.25;
        input.data[1] = -0.5;
        input.data[2] = 0.5;
        input.data[3] = -0.25;

        const out = createAudioBuffer(1, 4);
        dist.process([input], [out], 4);

        const tanh1 = Math.tanh(1);
        expect(out.data[0]).toBeCloseTo(Math.tanh(0.25) / tanh1, 6);
        expect(out.data[1]).toBeCloseTo(Math.tanh(-0.5) / tanh1, 6);
        expect(out.data[2]).toBeCloseTo(Math.tanh(0.5) / tanh1, 6);
        expect(out.data[3]).toBeCloseTo(Math.tanh(-0.25) / tanh1, 6);

        expect(out.data[0]).toBeCloseTo(0.25, 0);
        expect(out.data[2]).toBeCloseTo(0.5, 0);
    });

    test('high drive clips peaks (output amplitude < input for large inputs)', () => {
        const dist = new DistortionModule(1);
        dist.setParameter(DistortionParam.DRIVE, 50);
        dist.setParameter(DistortionParam.MIX, 1);

        const input = createAudioBuffer(1, 4);
        input.data[0] = 2;
        input.data[1] = -2;
        input.data[2] = 5;
        input.data[3] = -5;

        const out = createAudioBuffer(1, 4);
        dist.process([input], [out], 4);

        expect(Math.abs(out.data[0])).toBeLessThan(2);
        expect(Math.abs(out.data[1])).toBeLessThan(2);
        expect(Math.abs(out.data[2])).toBeLessThan(5);
        expect(Math.abs(out.data[3])).toBeLessThan(5);
    });

    test('mix=0 passes dry signal', () => {
        const dist = new DistortionModule(1);
        dist.setParameter(DistortionParam.DRIVE, 100);
        dist.setParameter(DistortionParam.MIX, 0);

        const input = createAudioBuffer(1, 4);
        input.data[0] = 0.5;
        input.data[1] = -0.5;
        input.data[2] = 1;
        input.data[3] = -1;

        const out = createAudioBuffer(1, 4);
        dist.process([input], [out], 4);

        expect(out.data[0]).toBe(0.5);
        expect(out.data[1]).toBe(-0.5);
        expect(out.data[2]).toBe(1);
        expect(out.data[3]).toBe(-1);
    });

    test('mix=1 fully distorted', () => {
        const dist = new DistortionModule(1);
        dist.setParameter(DistortionParam.DRIVE, 100);
        dist.setParameter(DistortionParam.MIX, 1);

        const input = createAudioBuffer(1, 4);
        input.data[0] = 1;
        input.data[1] = -1;

        const out = createAudioBuffer(1, 4);
        dist.process([input], [out], 2);

        const tanh100 = Math.tanh(100);
        const expected0 = Math.tanh(100) / tanh100;
        const expected1 = Math.tanh(-100) / tanh100;
        expect(out.data[0]).toBeCloseTo(expected0, 6);
        expect(out.data[1]).toBeCloseTo(expected1, 6);
    });

    test('missing audio input outputs zeros', () => {
        const dist = new DistortionModule(1);
        const out = createAudioBuffer(1, 4);
        out.data.fill(1);

        dist.process([], [out], 4);

        expect(Array.from(out.data)).toEqual([0, 0, 0, 0]);
    });

    test('reset is a no-op (parameters unchanged)', () => {
        const dist = new DistortionModule(1);
        dist.setParameter(DistortionParam.DRIVE, 50);
        dist.setParameter(DistortionParam.MIX, 0.5);
        dist.reset();

        expect(dist.getParameter(DistortionParam.DRIVE)).toBe(50);
        expect(dist.getParameter(DistortionParam.MIX)).toBe(0.5);
    });
});
