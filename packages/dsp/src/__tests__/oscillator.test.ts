import { PolyOscillator, WaveType } from '../oscillator';

describe('PolyOscillator', () => {
    let osc: PolyOscillator;
    const SAMPLE_RATE = 44100;

    beforeEach(() => {
        osc = new PolyOscillator(SAMPLE_RATE);
    });

    test('should initialize cleanly', () => {
        expect(osc).toBeDefined();
    });

    test('should generate silence by default', () => {
        const buffer = new Float32Array(128);
        osc.process(buffer);
        // Expect all zeros
        expect(buffer.every(v => v === 0)).toBe(true);
    });

    test('should produce signal on noteOn', () => {
        const buffer = new Float32Array(128);
        osc.setWaveType(WaveType.Square); // Easiest to verify amplitude
        osc.noteOn(0, 440, 1.0);

        osc.process(buffer);

        // Check signal presence
        // Square wave should be +/- 1 (or close to it)
        const hasSignal = buffer.some(v => v !== 0);
        expect(hasSignal).toBe(true);

        // Simple amplitude check
        const maxVal = Math.max(...buffer);
        expect(maxVal).toBeLessThanOrEqual(1.0);
        expect(maxVal).toBeGreaterThan(0);
    });

    test('should stop signal on noteOff', () => {
        const buffer = new Float32Array(128);
        osc.noteOn(0, 440, 1.0);
        osc.process(buffer);

        osc.noteOff(0);
        buffer.fill(0); // Reset buffer since process adds/fills
        osc.process(buffer);

        // Should be silent
        expect(buffer.every(v => v === 0)).toBe(true);
    });

    // Verification of Zero Allocation would require memory profiling tools,
    // but code review confirms no 'new' keywords in process loop.
});
