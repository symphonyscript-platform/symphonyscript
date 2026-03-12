import { createAudioBuffer } from '../buffer-utils';
import { AmplifierModule, AmplifierParam } from '../modules/amplifier';

describe('amplifier module', () => {
    test('passes through audio when gain=1 and no control input', () => {
        const amp = new AmplifierModule(1);
        const input = createAudioBuffer(1, 4);
        input.data[0] = 0.25;
        input.data[1] = -0.5;
        input.data[2] = 1;
        input.data[3] = -1;

        const out = createAudioBuffer(1, 4);
        amp.process([input], [out], 4);

        expect(Array.from(out.data)).toEqual([0.25, -0.5, 1, -1]);
    });

    test('scales with base gain', () => {
        const amp = new AmplifierModule(1);
        amp.setParameter(AmplifierParam.GAIN, 0.5);

        const input = createAudioBuffer(1, 4);
        input.data[0] = 0.2;
        input.data[1] = -0.4;
        input.data[2] = 1;
        input.data[3] = -1;

        const out = createAudioBuffer(1, 4);
        amp.process([input], [out], 4);

        expect(out.data[0]).toBeCloseTo(0.1, 6);
        expect(out.data[1]).toBeCloseTo(-0.2, 6);
        expect(out.data[2]).toBeCloseTo(0.5, 6);
        expect(out.data[3]).toBeCloseTo(-0.5, 6);
    });

    test('applies control modulation per sample', () => {
        const amp = new AmplifierModule(1);
        amp.setParameter(AmplifierParam.GAIN, 2);

        const input = createAudioBuffer(1, 4);
        input.data[0] = 1;
        input.data[1] = 1;
        input.data[2] = 1;
        input.data[3] = 1;

        const control = createAudioBuffer(1, 4);
        control.data[0] = 0;
        control.data[1] = 0.25;
        control.data[2] = 0.5;
        control.data[3] = 1;

        const out = createAudioBuffer(1, 4);
        amp.process([input, control], [out], 4);

        expect(Array.from(out.data)).toEqual([0, 0.5, 1, 2]);
    });

    test('missing audio input outputs zeros', () => {
        const amp = new AmplifierModule(1);
        const out = createAudioBuffer(1, 4);
        out.data.fill(1);

        amp.process([], [out], 4);

        expect(Array.from(out.data)).toEqual([0, 0, 0, 0]);
    });

    test('sanitize invalid gain', () => {
        const amp = new AmplifierModule(1);
        amp.setParameter(AmplifierParam.GAIN, Number.NaN);
        expect(amp.getParameter(AmplifierParam.GAIN)).toBe(1);

        amp.setParameter(AmplifierParam.GAIN, Number.POSITIVE_INFINITY);
        expect(amp.getParameter(AmplifierParam.GAIN)).toBe(1);

        amp.setParameter(AmplifierParam.GAIN, 0.75);
        amp.reset();
        expect(amp.getParameter(AmplifierParam.GAIN)).toBe(1);
    });
});
