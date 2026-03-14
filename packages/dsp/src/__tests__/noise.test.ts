import { createAudioBuffer } from '../buffer-utils';
import {
    NoiseModule,
    NoiseParam,
    NoiseWaveform,
} from '../modules/noise';

function hasNonZero(data: Float32Array): boolean {
    for (let i = 0; i < data.length; i += 1) {
        if (data[i] !== 0) {
            return true;
        }
    }
    return false;
}

function rms(data: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i += 1) {
        sum += data[i] * data[i];
    }
    return Math.sqrt(sum / data.length);
}

describe('noise module', () => {
    test('white noise produces non-zero output', () => {
        const noise = new NoiseModule(1);
        noise.setParameter(NoiseParam.WAVEFORM, NoiseWaveform.WHITE);
        noise.setParameter(NoiseParam.AMPLITUDE, 1);

        const out = createAudioBuffer(1, 256);
        noise.process([], [out], 256);

        expect(hasNonZero(out.data)).toBe(true);
    });

    test('pink noise produces non-zero output', () => {
        const noise = new NoiseModule(1);
        noise.setParameter(NoiseParam.WAVEFORM, NoiseWaveform.PINK);
        noise.setParameter(NoiseParam.AMPLITUDE, 1);

        const out = createAudioBuffer(1, 256);
        noise.process([], [out], 256);

        expect(hasNonZero(out.data)).toBe(true);
    });

    test('amplitude=0 produces silence', () => {
        const noise = new NoiseModule(1);
        noise.setParameter(NoiseParam.WAVEFORM, NoiseWaveform.WHITE);
        noise.setParameter(NoiseParam.AMPLITUDE, 0);

        const out = createAudioBuffer(1, 256);
        noise.process([], [out], 256);

        expect(hasNonZero(out.data)).toBe(false);
        expect(rms(out.data)).toBe(0);
    });

    test('reset clears pink noise state', () => {
        const noise = new NoiseModule(1);
        noise.setParameter(NoiseParam.WAVEFORM, NoiseWaveform.PINK);
        noise.setParameter(NoiseParam.AMPLITUDE, 1);

        const out1 = createAudioBuffer(1, 64);
        noise.process([], [out1], 64);
        const out2 = createAudioBuffer(1, 64);
        noise.process([], [out2], 64);

        noise.reset();

        const out3 = createAudioBuffer(1, 64);
        noise.process([], [out3], 64);

        expect(hasNonZero(out3.data)).toBe(true);
        expect(() => noise.reset()).not.toThrow();
        const out4 = createAudioBuffer(1, 64);
        noise.process([], [out4], 64);
        expect(hasNonZero(out4.data)).toBe(true);
    });
});
