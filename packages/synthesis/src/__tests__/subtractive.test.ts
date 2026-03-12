import { OscillatorWaveform, StealPolicy } from '@symphonyscript/dsp';
import { createSubtractiveInstrument } from '../subtractive';

function hasNonZeroSamples(data: Float32Array): boolean {
    for (let i = 0; i < data.length; i += 1) {
        if (Math.abs(data[i]) > 0) {
            return true;
        }
    }
    return false;
}

function rms(data: Float32Array): number {
    let sumSquares = 0;
    for (let i = 0; i < data.length; i += 1) {
        const sample = data[i];
        sumSquares += sample * sample;
    }
    return Math.sqrt(sumSquares / data.length);
}

describe('createSubtractiveInstrument', () => {
    test('factory returns instrument with configured maxVoices and name', () => {
        const instrument = createSubtractiveInstrument({
            name: 'Lead',
            maxVoices: 3,
        });

        expect(instrument.name).toBe('Lead');
        expect(instrument.maxVoices).toBe(3);
    });

    test('noteOn + render produces non-zero output', () => {
        const instrument = createSubtractiveInstrument();

        instrument.noteOn(69, 1, 0, 0);
        const output = instrument.render(64);

        expect(hasNonZeroSamples(output.data)).toBe(true);
    });

    test('StealPolicy.NONE respected when full', () => {
        const instrument = createSubtractiveInstrument({
            maxVoices: 1,
            stealPolicy: StealPolicy.NONE,
        });

        const first = instrument.noteOn(60, 1, 0, 0);
        const second = instrument.noteOn(64, 1, 0, 1);

        expect(first).toBe(0);
        expect(second).toBe(-1);
    });

    test('option overrides apply waveform/release/gain without throwing', () => {
        const lowGain = createSubtractiveInstrument({
            waveform: OscillatorWaveform.SQUARE,
            releaseSec: 0.001,
            gain: 0.1,
        });
        const highGain = createSubtractiveInstrument({
            waveform: OscillatorWaveform.SQUARE,
            releaseSec: 0.5,
            gain: 0.8,
        });

        expect(() => {
            lowGain.noteOn(69, 1, 0, 0);
            highGain.noteOn(69, 1, 0, 0);
            lowGain.render(64);
            highGain.render(64);
        }).not.toThrow();

        const lowGainOut = lowGain.render(64);
        const highGainOut = highGain.render(64);
        expect(rms(highGainOut.data)).toBeGreaterThan(rms(lowGainOut.data));

        lowGain.noteOff(69, 0);
        highGain.noteOff(69, 0);

        for (let i = 0; i < 8; i += 1) {
            lowGain.render(64);
            highGain.render(64);
        }

        expect(lowGain.getActiveVoiceCount()).toBe(0);
        expect(highGain.getActiveVoiceCount()).toBeGreaterThan(0);
    });
});
