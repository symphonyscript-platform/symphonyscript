import { Clip, initSession } from '../index';
import { SiliconSynapse, SiliconBridge } from '@symphonyscript/kernel';

describe('.stack() PARALLEL Polyphony', () => {
    let bridge: SiliconBridge;

    beforeEach(() => {
        const linker = SiliconSynapse.create({
            nodeCapacity: 1024,
            safeZoneTicks: 0
        });
        bridge = new SiliconBridge(linker);
        initSession(bridge);
    });

    test('Voice starts at same tick as main', () => {
        const clip = Clip.clip('Parallel');
        clip.note('C4', 480);  // Main @ tick 0

        const tickBefore = clip.getCurrentTick();  // 480

        clip.stack((voice) => {
            // Voice should start at tick 480 (same as main's current position)
            expect(voice.getCurrentTick()).toBe(tickBefore);
            voice.note('E4', 480);
        });

        // Main cursor unchanged by stack
        expect(clip.getCurrentTick()).toBe(480);
    });

    test('Multiple voices at same tick', () => {
        const clip = Clip.clip('Polyphony');
        clip
            .note('C4', 480)  // tick 0
            .stack((v1) => v1.note('E4', 480))  // starts @ 480
            .stack((v2) => v2.note('G4', 480))  // starts @ 480
            .note('D4', 480);  // tick 480

        // Main: 480 (C4) + 480 (D4) = 960
        expect(clip.getCurrentTick()).toBe(960);
    });

    test('Stack returns this for chaining', () => {
        const clip = Clip.clip('Chain');
        const result = clip.stack((v) => v.note('C4'));
        expect(result).toBe(clip);
    });

    test('Voice can advance independently', () => {
        const clip = Clip.clip('Independent');
        clip.note('C4', 480);  // Main @ 0-480

        clip.stack((voice) => {
            voice.note('E4', 240).note('G4', 240);  // Voice @ 480-960
        });

        // Main continues at 480
        clip.note('D4', 480);  // Main @ 480-960

        expect(clip.getCurrentTick()).toBe(960);
    });
});
