export class TimeKeeper {
    private bpm: number = 120;
    private ppq: number = 960;
    private sampleRate: number = 44100;

    // Derived
    private samplesPerTick: number = 0;

    /**
     * @param sampleRate AudioContext Sample Rate (e.g. 44100)
     */
    constructor(sampleRate: number) {
        this.sampleRate = sampleRate;
        this.updateDerived();
    }

    updateBpm(bpm: number) {
        if (this.bpm === bpm) return;
        this.bpm = bpm;
        this.updateDerived();
    }

    private updateDerived() {
        // Ticks per minute = BPM * PPQ
        // Ticks per second = (BPM * PPQ) / 60
        // Samples per tick = SampleRate / TicksPerSecond
        //                  = SampleRate / ((BPM * PPQ) / 60)
        //                  = (SampleRate * 60) / (BPM * PPQ)
        this.samplesPerTick = (this.sampleRate * 60) / (this.bpm * this.ppq);
    }

    /**
     * Calculate how many ticks elapse in a given number of samples.
     */
    getTicksForSamples(samples: number): number {
        return samples / this.samplesPerTick;
    }

    /**
     * Calculate the sample offset for a specific tick relative to a start tick.
     * Used for scheduling note events within a block.
     * 
     * @param eventTick The absolute tick of the event
     * @param startTick The absolute tick at the start of the audio block
     * @returns The sample offset (0-indexed) within the block. Can be fractional.
     */
    getSampleOffset(eventTick: number, startTick: number): number {
        const deltaTicks = eventTick - startTick;
        return deltaTicks * this.samplesPerTick;
    }
}
