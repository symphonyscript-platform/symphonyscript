import { SiliconProcessor } from '../runtime/processor';
import { SiliconBridge, SiliconSynapse, createLinkerSAB, OPCODE } from '@symphonyscript/kernel';

describe('SiliconProcessor Mixer Integration', () => {
    let processor: SiliconProcessor;
    let sab: SharedArrayBuffer;
    let bridge: SiliconBridge;

    beforeEach(() => {
        sab = createLinkerSAB({ nodeCapacity: 1000 });
        const linker = new SiliconSynapse(sab);
        bridge = new SiliconBridge(linker);

        processor = new SiliconProcessor();
        // Simulate INIT
        (processor.port.onmessage as any)({
            data: { type: 'INIT', sab }
        });

        // Mock global sampleRate if needed, but processor uses it in constructor.
        // Assuming test setup defines it.
    });

    it('should route audio through the bus', () => {
        // 1. Create a Note
        bridge.insertAsync(OPCODE.NOTE, 60, 100, 1000, 0, false, 1);

        // 2. Play
        (processor.port.onmessage as any)({ data: { type: 'PLAY' } });

        // 3. Process
        // Output is stereo [L, R]
        const outputL = new Float32Array(128);
        const outputR = new Float32Array(128);
        const outputs = [[outputL, outputR]];

        processor.process([], outputs, {});

        // 4. Verify Signal Presence
        // We assume Unity Gain and Center Pan (default inputs)
        // With Constant Power Pan Law (-3dB center), we expect ~0.707 amplitude relative to OSC output.
        // Sine wave peak is 1.0 * vel(100/127=0.78).
        // 0.78 * 0.707 = 0.55.

        let hasSignal = false;
        let maxAmp = 0;
        for (let i = 0; i < 128; i++) {
            if (Math.abs(outputL[i]) > 0.001) hasSignal = true;
            maxAmp = Math.max(maxAmp, Math.abs(outputL[i]));
        }

        expect(hasSignal).toBe(true);
        expect(maxAmp).toBeGreaterThan(0.1);

        // Verify Stereo Correlation (Center Pan -> L=R)
        for (let i = 0; i < 128; i++) {
            expect(outputL[i]).toBeCloseTo(outputR[i], 4);
        }
    });
});
