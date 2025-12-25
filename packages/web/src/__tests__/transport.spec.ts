import { SiliconProcessor } from '../runtime/processor';
import { SiliconBridge, SiliconSynapse, createLinkerSAB, HDR } from '@symphonyscript/kernel';
import { TimeKeeper } from '../runtime/time-keeper';

describe('SiliconProcessor Transport Logic', () => {
    let processor: SiliconProcessor;
    let sab: SharedArrayBuffer;
    let bridge: SiliconBridge;
    let linker: SiliconSynapse; // Direct access for verification

    beforeEach(() => {
        sab = createLinkerSAB({ nodeCapacity: 1000 });
        linker = new SiliconSynapse(sab);
        bridge = new SiliconBridge(linker);

        processor = new SiliconProcessor();
        // Simulate INIT message
        (processor.port.onmessage as any)({
            data: { type: 'INIT', sab }
        });
    });

    it('should not advance tick when stopped', () => {
        const output = new Float32Array(128);
        processor.process([], [[output]], {});

        expect(bridge.getPlayheadTick()).toBe(0);
    });

    it('should advance tick when playing', () => {
        // Set BPM
        bridge.setBpm(120);

        // Send PLAY
        (processor.port.onmessage as any)({ data: { type: 'PLAY' } });

        const output = new Float32Array(128);
        processor.process([], [[output]], {});

        // 120 BPM @ 44100Hz
        // Ticks = Samples * (BPM * PPQ) / (60 * SampleRate)
        // 128 * (120 * 960) / (60 * 44100) = 14745600 / 2646000 ≈ 5.57 ticks
        const ticks = bridge.getPlayheadTick();
        expect(ticks).toBeGreaterThan(0);
        // 5.57 ticks -> truncated to 5
        expect(ticks).toBe(5);
    });

    it('should pause and resume', () => {
        bridge.setBpm(120);
        (processor.port.onmessage as any)({ data: { type: 'PLAY' } });

        const output = new Float32Array(128);
        processor.process([], [[output]], {});

        const tickAfterPlay = bridge.getPlayheadTick();
        expect(tickAfterPlay).toBeGreaterThan(0);

        // PAUSE
        (processor.port.onmessage as any)({ data: { type: 'PAUSE' } });
        processor.process([], [[output]], {});

        const tickAfterPause = bridge.getPlayheadTick();
        expect(tickAfterPause).toBe(tickAfterPlay); // Should not advance

        // RESUME
        (processor.port.onmessage as any)({ data: { type: 'PLAY' } });
        processor.process([], [[output]], {});

        expect(bridge.getPlayheadTick()).toBeGreaterThan(tickAfterPlay);
    });

    it('should stop and reset', () => {
        bridge.setBpm(120);
        (processor.port.onmessage as any)({ data: { type: 'PLAY' } });

        // Run specific amount
        const output = new Float32Array(128);
        processor.process([], [[output]], {});
        expect(bridge.getPlayheadTick()).toBeGreaterThan(0);

        // STOP
        (processor.port.onmessage as any)({ data: { type: 'STOP' } });

        // Verify Processor internal state (via side-effect on SAB)
        // Process one more block to ensure it updates SAB if logic requires process loop,
        // BUT STOP handler updates SAB immediately in my implementation?
        // Let's check: "this.linker.setPlayheadTick(0);" is in the STOP handler.

        expect(bridge.getPlayheadTick()).toBe(0);

        // Run process loop, should stay 0
        processor.process([], [[output]], {});
        expect(bridge.getPlayheadTick()).toBe(0);
    });

    it('should react to BPM changes dynamically', () => {
        (processor.port.onmessage as any)({ data: { type: 'PLAY' } });

        // Start 60 BPM
        bridge.setBpm(60);
        let output = new Float32Array(128);
        processor.process([], [[output]], {});
        const ticks60 = bridge.getPlayheadTick();

        // Reset
        (processor.port.onmessage as any)({ data: { type: 'STOP' } });
        (processor.port.onmessage as any)({ data: { type: 'PLAY' } });

        // Double tempo 120 BPM
        bridge.setBpm(120);
        output = new Float32Array(128);
        processor.process([], [[output]], {});
        const ticks120 = bridge.getPlayheadTick();

        // Should be approximately double
        // Should be approximately double, allowing for integer truncation differences
        // 60BPM = ~2.7 ticks -> stored as 2
        // 120BPM = ~5.5 ticks -> stored as 5
        // 2 * 2 = 4 != 5
        expect(ticks120).toBeGreaterThanOrEqual(ticks60 * 2);
        expect(ticks120).toBeLessThan(ticks60 * 3);
    });
});
