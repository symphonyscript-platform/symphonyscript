
import { SynapticClip } from '../clips/SynapticClip';
import { SiliconBridge } from '@symphonyscript/kernel';
import { PitchBendOperation } from '../types';

// Mock SiliconBridge
class MockBridge extends SiliconBridge {
    constructor() {
        // Mock Linker
        const sab = new SharedArrayBuffer(1024);
        const mockLinker = {
            getSAB: () => sab
        } as any;
        super(mockLinker);
    }

    insertAsync = jest.fn().mockReturnValue(1);
}

// Concrete implementation of abstract SynapticClip for testing
class TestClip extends SynapticClip {
    getCurrentTick() { return 0; }
    advanceTick(ticks: number) { }
    generateSourceId() { return 1; }
}

describe('Vibrato LFO', () => {
    let clip: TestClip;
    let bridge: MockBridge;

    beforeEach(() => {
        bridge = new MockBridge();
        clip = new TestClip(bridge);
    });

    test('vibrato(rate, depth) sets state', () => {
        clip.vibrato(5, 0.5);
        // We can't access protected state directly easily without casting or inspection helper
        // But we can check if it produces ops when flushing a note

        // Mock flushNote internals or call it
        // We need to trigger emitVibratoLFO via flushNote

        clip.flushNote(60, 0.8, 1, 0, false, 1);

        // Check operations
        const ops = clip.toOperations();
        const pbOps = ops.filter(op => op.kind === 'pitchBend') as PitchBendOperation[];

        expect(pbOps.length).toBeGreaterThan(0);

        // Verify oscillation
        // Should have positive and negative values
        const hasPositive = pbOps.some(op => op.value > 0);
        const hasNegative = pbOps.some(op => op.value < 0);
        expect(hasPositive).toBe(true);
        expect(hasNegative).toBe(true);

        // Verify reset at end
        const lastOp = pbOps[pbOps.length - 1];
        expect(lastOp.value).toBe(0);
        expect(lastOp.tick).toBe(1); // Start 0 + duration 1
    });

    test('vibratoOff() disables vibrato', () => {
        clip.vibrato(5, 0.5);
        clip.vibratoOff();

        clip.flushNote(60, 0.8, 1, 0, false, 1);

        const ops = clip.toOperations();
        const pbOps = ops.filter(op => op.kind === 'pitchBend');
        expect(pbOps.length).toBe(0);
    });

    test('rate controls frequency', () => {
        // High rate
        const clipHigh = new TestClip(new MockBridge());
        clipHigh.vibrato(10, 0.5);
        clipHigh.flushNote(60, 0.8, 1, 0, false, 1);
        const opsHigh = clipHigh.toOperations() as PitchBendOperation[];

        // Low rate
        const clipLow = new TestClip(new MockBridge());
        clipLow.vibrato(1, 0.5);
        clipLow.flushNote(60, 0.8, 1, 0, false, 1);
        const opsLow = clipLow.toOperations() as PitchBendOperation[];

        // Count zero crossings or direction changes? 
        // Simple check: compare first peak position or simply check data differs
        // Or check number of cycles.
        // For rate=1, duration=1, should cover 1 cycle? (if rate is cycles/beat)
        // For rate=10, 10 cycles.

        // Just verify they are different
        expect(opsHigh.length).toBe(opsLow.length); // Step size is constant
        expect(opsHigh[5].value).not.toBe(opsLow[5].value);
    });
});
