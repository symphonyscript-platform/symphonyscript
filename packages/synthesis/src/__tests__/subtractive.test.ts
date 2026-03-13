import { FilterType, OscillatorWaveform, StealPolicy } from '@symphonyscript/dsp';
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

    test('filter in graph changes timbre (low cutoff dulls the sound)', () => {
        const unfiltered = createSubtractiveInstrument({
            filterCutoff: 20000,
            filterResonance: 0,
        });
        const filtered = createSubtractiveInstrument({
            filterCutoff: 200,
            filterResonance: 0,
        });

        unfiltered.noteOn(69, 1, 0, 0);
        filtered.noteOn(69, 1, 0, 0);

        const unfilteredOut = unfiltered.render(64);
        const filteredOut = filtered.render(64);

        expect(hasNonZeroSamples(unfilteredOut.data)).toBe(true);
        expect(hasNonZeroSamples(filteredOut.data)).toBe(true);
        expect(rms(filteredOut.data)).toBeLessThan(rms(unfilteredOut.data));
    });

    test('filter envelope params apply without throwing', () => {
        const instrument = createSubtractiveInstrument({
            filterAttackSec: 0.02,
            filterDecaySec: 0.3,
            filterSustainLevel: 0.4,
            filterReleaseSec: 0.25,
            filterCutoff: 4000,
            filterResonance: 2,
            filterType: FilterType.BANDPASS,
        });

        expect(() => {
            instrument.noteOn(60, 0.8, 0, 0);
            instrument.render(64);
            instrument.noteOff(60, 0);
            for (let i = 0; i < 16; i += 1) {
                instrument.render(64);
            }
        }).not.toThrow();
    });

    test('filter envelope opens over time (attack)', () => {
        const blockSize = 64;
        const instrument = createSubtractiveInstrument({
            filterAttackSec: 0.05,
            sampleRate: 48000,
            blockSize,
        });

        instrument.noteOn(60, 1, 0, 0);

        const out0 = instrument.render(blockSize);
        const rms0 = rms(out0.data);

        instrument.render(blockSize);
        instrument.render(blockSize);
        instrument.render(blockSize);
        const out4 = instrument.render(blockSize);
        const rms4 = rms(out4.data);

        expect(rms4).toBeGreaterThan(rms0);
    });

    test('filter fully closed produces near-silence', () => {
        const filterAttackSec = 0.01;
        const filterDecaySec = 0.1;
        const sampleRate = 48000;
        const blockSize = 64;
        const blocksToSustain =
            Math.ceil((filterAttackSec + filterDecaySec) * sampleRate / blockSize) + 2;

        const instrument = createSubtractiveInstrument({
            filterCutoff: 1,
            filterSustainLevel: 0,
            filterAttackSec,
            filterDecaySec,
            sampleRate,
            blockSize,
        });

        instrument.noteOn(60, 1, 0, 0);

        let lastOut: { data: Float32Array } = { data: new Float32Array(0) };
        for (let i = 0; i < blocksToSustain; i += 1) {
            lastOut = instrument.render(blockSize);
        }

        expect(rms(lastOut.data)).toBeLessThan(1e-5);
    });
});
