import { StereoBus } from '../stereo-bus';

describe('StereoBus', () => {
    let bus: StereoBus;
    const size = 128;

    beforeEach(() => {
        bus = new StereoBus(size);
    });

    it('should initialize with silence', () => {
        const outL = new Float32Array(size);
        const outR = new Float32Array(size);
        bus.process(outL, outR);

        for (let i = 0; i < size; i++) {
            expect(outL[i]).toBe(0);
            expect(outR[i]).toBe(0);
        }
    });

    it('should sum inputs correctly (center pan)', () => {
        const input = new Float32Array(size).fill(1.0);

        // Add input at center pan (0.0) -> 0.707
        bus.input(input, 0.0);

        const outL = new Float32Array(size);
        const outR = new Float32Array(size);
        bus.process(outL, outR);

        // Input Pan (0.707) * Master Pan Center (0.707) = 0.5
        expect(outL[0]).toBeCloseTo(0.5, 3);
        expect(outR[0]).toBeCloseTo(0.5, 3);
    });

    it('should pan hard left', () => {
        const input = new Float32Array(size).fill(1.0);

        // Pan -1.0 -> Left 1.0, Right 0.0
        bus.input(input, -1.0);

        const outL = new Float32Array(size);
        const outR = new Float32Array(size);
        bus.process(outL, outR);

        // Left 1.0 * Master Center 0.707 = 0.707
        expect(outL[0]).toBeCloseTo(0.707, 3);
        expect(outR[0]).toBeCloseTo(0.0, 3); // Silence
    });

    it('should apply master volume', () => {
        const input = new Float32Array(size).fill(1.0);
        bus.input(input, -1.0); // Full Left -> 1.0

        bus.setVolume(0.5); // Master Volume

        const outL = new Float32Array(size);
        const outR = new Float32Array(size);
        bus.process(outL, outR);

        // 1.0 * Master Center (0.707) * Volume (0.5) = 0.3535
        expect(outL[0]).toBeCloseTo(0.3535, 3);
    });

    it('should accumulate multiple inputs', () => {
        const input1 = new Float32Array(size).fill(0.5);
        const input2 = new Float32Array(size).fill(0.5);

        bus.input(input1, -1.0); // 0.5 Left
        bus.input(input2, -1.0); // 0.5 Left

        const outL = new Float32Array(size);
        const outR = new Float32Array(size);
        bus.process(outL, outR);

        // (0.5 + 0.5) * Master Center (0.707) = 0.707
        expect(outL[0]).toBeCloseTo(0.707, 3);
    });
});
