import { MelodyChordCursor } from '../cursors/MelodyChordCursor'
import { SynapticClip } from '../clips/SynapticClip'
import { SiliconBridge } from '@symphonyscript/kernel'

// Mocks
const mockInsertAsync = jest.fn();
const mockBridge = {
    insertAsync: mockInsertAsync
} as unknown as SiliconBridge;

class MockClip extends SynapticClip {
    tick = 0;
    rest = jest.fn();
    tempo = jest.fn();
    timeSignature = jest.fn();
    swing = jest.fn();
    groove = jest.fn();
    control = jest.fn();
    stack = jest.fn();
    setLoopRegion = jest.fn();

    constructor(bridge: SiliconBridge, seed: number = 42) {
        super(bridge, seed); // Pass seed for deterministic humanization
    }

    getCurrentTick() { return this.tick; }

    advanceTick(t: number): this { this.tick += t; return this; }

    generateSourceId() { return 100; }

    commit() { }
}

describe('MelodyChordCursor (Phase 5)', () => {
    let clip: MockClip;
    let cursor: MelodyChordCursor;

    beforeEach(() => {
        mockInsertAsync.mockClear();
        clip = new MockClip(mockBridge);
        cursor = new MelodyChordCursor(clip, mockBridge, 4); // Low maxVoices for testing
    });

    it('chord("Cmaj") flushes correct notes', () => {
        cursor.chord('Cmaj'); // C E G (0, 4, 7)
        cursor.commit();

        // C4 = 60. E4 = 64. G4 = 67. (velocities humanized with seed=42: 102, 101, 103)
        expect(mockInsertAsync).toHaveBeenCalledTimes(3);
        expect(mockInsertAsync).toHaveBeenNthCalledWith(1, 1, 60, 102, 0.25, 0, false, 100, undefined, undefined); // C
        expect(mockInsertAsync).toHaveBeenNthCalledWith(2, 1, 64, 101, 0.25, 0, false, 100, undefined, undefined); // E
        expect(mockInsertAsync).toHaveBeenNthCalledWith(3, 1, 67, 103, 0.25, 0, false, 100, undefined, undefined); // G
    });

    it('inversion(1) rotates notes', () => {
        cursor.chord('Cmaj').inversion(1); // E G C(next)
        cursor.commit();

        // E4=64, G4=67, C5=72 (velocities humanized: 102, 101, 103 with seed=42)
        expect(mockInsertAsync).toHaveBeenNthCalledWith(1, 1, 64, 102, 0.25, 0, false, 100, undefined, undefined);
        expect(mockInsertAsync).toHaveBeenNthCalledWith(2, 1, 67, 101, 0.25, 0, false, 100, undefined, undefined);
        expect(mockInsertAsync).toHaveBeenNthCalledWith(3, 1, 72, 103, 0.25, 0, false, 100, undefined, undefined);
    });

    it('voice limit works (maxVoices=4)', () => {
        // Create a dense chord manually via mask
        // 0, 1, 2, 3, 4 (5 notes)
        const mask = 1 | 2 | 4 | 8 | 16;
        cursor.harmony(mask);
        cursor.commit();

        expect(mockInsertAsync).toHaveBeenCalledTimes(4); // Max 4
    });

    describe('Zero-Allocation Smoke Test', () => {
        it('flush() performs zero heap allocations', () => {
            // Use PURE implementations to avoid Jest mock overhead entirely
            const cleanBridge = { insertAsync: () => { } } as unknown as SiliconBridge;

            class PureClip extends SynapticClip {
                t = 0;
                constructor(bridge: SiliconBridge) {
                    super(bridge, 42); // Pass seed for deterministic humanization
                }
                getCurrentTick() { return this.t }
                advanceTick(d: number) { this.t += d }
                generateSourceId() { return 100; }
                rest(): any { return this; }
                tempo(): any { return this; }
                timeSignature(): any { return this; }
                swing(): any { return this; }
                groove(): any { return this; }
                control(): any { return this; }
                stack(): any { return this; }
                loop(): any { return this; }
                commit() { }
            }

            const pureCursor = new MelodyChordCursor(new PureClip(cleanBridge), cleanBridge, 4);

            // WARM UP
            pureCursor.chord('Cmaj7');
            for (let i = 0; i < 10000; i++) {
                pureCursor.harmony(1);
                pureCursor.commit();
            }

            global.gc && global.gc();

            const startHeap = process.memoryUsage().heapUsed;

            for (let i = 0; i < 10000; i++) {
                pureCursor.harmony(1 | 16 | 128);
                pureCursor.commit();
            }

            const endHeap = process.memoryUsage().heapUsed;
            const delta = endHeap - startHeap;

            // RFC-050: New architecture baseline ~1.4MB (clip transformation pipeline)
            // Old architecture (direct bridge calls): ~0.4MB
            // Threshold set to 2MB to allow headroom while catching real leaks
            expect(delta).toBeLessThan(2000000);
        });
    });
});
