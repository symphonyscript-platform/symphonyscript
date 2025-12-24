import { pack, unpack } from '../packer';
import { asHarmonyMask } from '../types';

// Environment guard for allocation tests
const hasMemoryAPI = typeof performance !== 'undefined' && 'memory' in performance;
const describeWithMemory = hasMemoryAPI ? describe : describe.skip;

describeWithMemory('Performance: Zero Allocation', () => {
    test('pack() allocates zero objects', () => {
        const before = (performance as any).memory.usedJSHeapSize;

        for (let i = 0; i < 100000; i++) {
            pack([0, 8, 14]);
        }

        const after = (performance as any).memory.usedJSHeapSize;
        const growth = after - before;

        // Allow minimal GC tolerance (< 1KB for 100k operations)
        expect(growth).toBeLessThan(1000);
    });

    test('unpack() allocates zero objects (callback mode)', () => {
        const mask = asHarmonyMask(0x4101);
        const before = (performance as any).memory.usedJSHeapSize;

        let sum = 0;
        for (let i = 0; i < 100000; i++) {
            unpack(mask, (interval) => { sum += interval; });
        }

        const after = (performance as any).memory.usedJSHeapSize;
        const growth = after - before;

        expect(growth).toBeLessThan(1000);
    });
});
