// Mock AudioWorkletProcessor environment is handled by setup-tests.ts now
import { SiliconProcessor } from '../runtime/processor';
import { SiliconBridge, SiliconSynapse, OPCODE, NODE, SOURCE_ID, HDR } from '@symphonyscript/kernel';
import { createLinkerSAB } from '@symphonyscript/kernel';

describe('SiliconProcessor Integration Full', () => {
    let processor: SiliconProcessor;
    let sab: SharedArrayBuffer;
    let synapse: SiliconSynapse;
    let bridge: SiliconBridge;

    beforeEach(() => {
        // Use factory to create correctly initialized SAB
        sab = createLinkerSAB({ nodeCapacity: 1000 });

        synapse = new SiliconSynapse(sab);
        bridge = new SiliconBridge(synapse);

        processor = new SiliconProcessor();
        const procAny = processor as any;
        if (procAny.port.onmessage) {
            procAny.port.onmessage({ data: { type: 'INIT', sab } } as MessageEvent);
        }
    });

    it('should play a note when traversed', () => {
        // 1. Insert Note at Tick 0
        const PITCH = 69;
        const VELOCITY = 100;
        const DURATION = 100;
        const BASE_TICK = 0;

        // Insert asynchronously (into Ring Buffer)
        // This relies on SiliconBridge using LocalAllocator
        // We use insertAsync which returns a pointer (or error code)
        const ptr = bridge.insertAsync(OPCODE.NOTE, PITCH, VELOCITY, DURATION, BASE_TICK, false, 1);

        // Send PLAY command to start the engine
        (processor.port.onmessage as any)({ data: { type: 'PLAY' } });

        if (ptr <= 0) {
            const err = Atomics.load(new Int32Array(sab), HDR.ERROR_FLAG);
            console.error('Insert failed via Bridge. Ptr:', ptr, 'Error:', err);

            // Debug capacity
            const cap = Atomics.load(new Int32Array(sab), HDR.NODE_CAPACITY);
            console.log('Capacity:', cap);
        }
        expect(ptr).toBeGreaterThan(0);

        // 2. Process Output
        const output = new Float32Array(128);
        const outputs = [[output]];

        // Run process()
        // This triggers polling, which triggers executeInsert, which links the node.
        // Then traversal finds the node.
        processor.process([], outputs, {});

        // Verify HEAD_PTR
        const head = Atomics.load(new Int32Array(sab), HDR.HEAD_PTR);

        if (head === 0) {
            console.error('Head is still NULL after process!');
            // Maybe command ring wasn't processed? check ring head/tail
            const rbHead = Atomics.load(new Int32Array(sab), HDR.RB_HEAD);
            const rbTail = Atomics.load(new Int32Array(sab), HDR.RB_TAIL);
            console.log(`RB Head: ${rbHead}, Tail: ${rbTail}`);
        }

        expect(head).not.toBe(0);

        // 3. Verify Audio
        let nonZeroCount = 0;
        for (let i = 0; i < output.length; i++) {
            if (output[i] !== 0) nonZeroCount++;
        }

        expect(nonZeroCount).toBeGreaterThan(0);
    });
});
