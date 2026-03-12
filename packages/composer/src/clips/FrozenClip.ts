import { FreezeOptions } from '../types';
import { SynapticClip } from './SynapticClip';

/**
 * Frozen clip handle for efficient clip reuse without operation snapshots.
 *
 * Task 058 strict mode:
 * - No operation arrays are stored here.
 * - Source clip kernel state remains the single source of truth.
 */
export class FrozenClip {
    public readonly name: string;
    private readonly sourceIds: number[] = [];
    private readonly pitches: number[] = [];
    private readonly velocities: number[] = [];
    private readonly durations: number[] = [];
    private readonly ticks: number[] = [];
    private readonly muted: boolean[] = [];
    private readonly expressionIds: number[] = [];

    constructor(
        public readonly source: SynapticClip,
        public readonly options: FreezeOptions
    ) {
        this.name = source.getClipName();
        source.visitKernelNotes((sourceId, pitch, velocity, duration, tick, isMuted, expressionId) => {
            this.sourceIds.push(sourceId);
            this.pitches.push(pitch);
            this.velocities.push(velocity);
            this.durations.push(duration);
            this.ticks.push(tick);
            this.muted.push(isMuted);
            this.expressionIds.push(expressionId ?? 0);
        });
    }

    /**
     * Get the total duration of the frozen clip in beats.
     */
    get duration(): number {
        let max = 0;
        for (let i = 0; i < this.ticks.length; i++) {
            const end = this.ticks[i] + this.durations[i];
            if (end > max) {
                max = end;
            }
        }
        return max;
    }

    /**
     * Get the number of notes in the frozen clip.
     */
    get noteCount(): number {
        return this.ticks.length;
    }

    /**
     * Visit frozen note snapshot.
     */
    visitNotes(
        cb: (sourceId: number, pitch: number, velocity: number, duration: number, tick: number, muted: boolean, expressionId?: number) => void
    ): void {
        for (let i = 0; i < this.ticks.length; i++) {
            const expressionId = this.expressionIds[i];
            cb(
                this.sourceIds[i],
                this.pitches[i],
                this.velocities[i],
                this.durations[i],
                this.ticks[i],
                this.muted[i],
                expressionId === 0 ? undefined : expressionId
            );
        }
    }
}
