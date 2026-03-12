import { TimeKeeper } from '../runtime/time-keeper';

describe('TimeKeeper', () => {
    let timeKeeper: TimeKeeper;
    const SAMPLE_RATE = 44100;

    beforeEach(() => {
        timeKeeper = new TimeKeeper(SAMPLE_RATE);
    });

    it('should calculate correct samples per tick', () => {
        // Default BPM 120, PPQ 960
        // Ticks per second = (120 * 960) / 60 = 1920
        // Samples per tick = 44100 / 1920 = 22.96875

        // Let's verify via getTicksForSamples
        const ticks = timeKeeper.getTicksForSamples(44100); // 1 second
        expect(ticks).toBe(1920);
    });

    it('should calculate sample offset correctly', () => {
        // Samples per tick = 22.96875
        // If event is 10 ticks after start:
        // Offset = 10 * 22.96875 = 229.6875

        const startTick = 100;
        const eventTick = 110;
        const offset = timeKeeper.getSampleOffset(eventTick, startTick);

        expect(offset).toBeCloseTo(229.6875);
    });

    it('should update derived values when BPM changes', () => {
        timeKeeper.updateBpm(60); // Half speed
        // Ticks per second = (60 * 960) / 60 = 960
        // Samples per tick = 44100 / 960 = 45.9375 (Double the previous)

        const ticks = timeKeeper.getTicksForSamples(44100);
        expect(ticks).toBe(960);
    });
});
