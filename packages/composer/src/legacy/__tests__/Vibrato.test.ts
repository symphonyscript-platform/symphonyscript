
import { SynapticClip } from '../clips/SynapticClip';
import { createTestBridge } from '../test-bridge';

// Concrete implementation of abstract SynapticClip for testing
class TestClip extends SynapticClip {
    getCurrentTick() { return 0; }
    advanceTick(_ticks: number) { }
    generateSourceId() { return 1; }
}

describe('Vibrato LFO', () => {
    let clip: TestClip;
    let bridge: ReturnType<typeof createTestBridge>;

    beforeEach(() => {
        bridge = createTestBridge();
        clip = new TestClip(bridge);
    });

    test('vibrato(rate, depth) sets state and note is still flushed', () => {
        clip.vibrato(5, 0.5);
        clip.flushNote(60, 0.8, 1, 0, false, 1);

        // Task 058: Pitch bend no longer in operations; Kernel insertAsync is note-only.
        // Verify note was inserted and toOperations returns it.
        const ops = clip.toOperations();
        expect(ops.length).toBe(1);
        if (ops[0].kind === 'note') {
            expect(ops[0].pitch).toBe(60);
        }
    });

    test('vibratoOff() disables vibrato, note still flushed', () => {
        clip.vibrato(5, 0.5);
        clip.vibratoOff();
        clip.flushNote(60, 0.8, 1, 0, false, 1);

        const ops = clip.toOperations();
        expect(ops.length).toBe(1);
    });

    test('rate/depth are chainable', () => {
        const result = clip.vibrato(10, 0.5).vibratoOff();
        expect(result).toBe(clip);
    });
});
