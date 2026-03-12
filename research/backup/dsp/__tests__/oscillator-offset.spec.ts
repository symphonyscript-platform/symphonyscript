import { PolyOscillator } from '../oscillator';

describe('PolyOscillator', () => {
    let oscillator: PolyOscillator;
    const SAMPLE_RATE = 44100;

    beforeEach(() => {
        oscillator = new PolyOscillator(SAMPLE_RATE);
    });

    it('should respect sample offset in noteOn', () => {
        const OFFSET = 64;
        const FREQUENCY = 440;
        const BUFFER_SIZE = 128;
        const output = new Float32Array(BUFFER_SIZE);

        oscillator.noteOn(0, FREQUENCY, 1.0, OFFSET);
        oscillator.process(output);

        // Check silence before offset
        for (let i = 0; i < OFFSET; i++) {
            expect(output[i]).toBe(0);
        }

        // Check signal after offset
        // We expect non-zero values (sine wave starts at 0, but by i=OFFSET it might be 0 if phase aligns, 
        // but phase starts at 0 effectively at the offset?
        // Note: The implementation increments phase per sample. 
        // If we skip samples, phase stays at 0 until we start processing?
        // Yes, my implementation does NOT increment phase for skipped samples.
        // So at index OFFSET, phase is still 0. Sin(0) is 0.
        // At OFFSET + 1, phase is increment. Sin(increment).

        expect(output[OFFSET]).toBeCloseTo(0); // Starts at phase 0
        expect(output[OFFSET + 1]).not.toBe(0); // Advances
    });

    it('should clear offset after first block', () => {
        const OFFSET = 64;
        const FREQUENCY = 440;
        const BUFFER_SIZE = 128;
        const output = new Float32Array(BUFFER_SIZE);

        oscillator.noteOn(0, FREQUENCY, 1.0, OFFSET);
        oscillator.process(output); // First block (offset applied)

        output.fill(0); // Reset buffer
        oscillator.process(output); // Second block (offset should be 0)

        // Should produce sound immediately at index 0
        expect(output[0]).not.toBe(0);
    });
});
