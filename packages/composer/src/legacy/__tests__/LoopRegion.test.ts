import { SynapticClip } from '../clips/SynapticClip';
import { MockConsumer } from '@symphonyscript/kernel';
import { createTestBridge } from '../test-bridge';

// Concrete Clip Implementation
class TestClip extends SynapticClip {
    getCurrentTick() { return 0; }
    advanceTick(t: number) { }
    generateSourceId() { return 1; }
    // Override setCycle to avoid "node has no content" error during simple build() test
    setCycle(length: number) { return this; }
}

describe('Loop Region', () => {
    test('build() includes loopRegion when enabled', () => {
        const bridge = createTestBridge();
        const clip = new TestClip(bridge);

        // Set loop region (start=0, end=480)
        // clip.setLoopRegion is already implemented in previous tasks?
        // Let's check SynapticClip lines 254-265 (view step 227)
        // Yes: setLoopRegion(start, end)
        clip.setLoopRegion(0, 480);

        const node = clip.build();

        expect(node.loopRegion).toBeDefined();
        expect(node.loopRegion).toEqual({
            start: 0,
            end: 480,
            enabled: true
        });
    });

    test('MockConsumer loops correctly', () => {
        // Use a larger buffer to satisfy MockConsumer expectations if any (HEADER)
        // 1024 bytes is enough for 64 byte header
        const buffer = new SharedArrayBuffer(1024);
        const consumer = new MockConsumer(buffer, 24); // tickRate 24

        consumer.enableLoop(true);
        consumer.setLoop(0, 100);

        // Set playhead near loop end
        consumer.setPlayheadTick(90);

        // Process one quantum (24 ticks)
        // Next playhead calculation: 90 + 24 = 114
        // Loop wrap: 114 >= 100
        // Overflow: 114 - 100 = 14
        // New playhead: 0 + 14 = 14

        consumer.process();

        expect(consumer.getPlayheadTick()).toBe(14);
    });
});
