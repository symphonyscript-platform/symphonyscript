import { ClipNode, FreezeOptions } from '../types';

/**
 * A frozen (pre-compiled) clip for efficient reuse.
 * Frozen clips can be played multiple times without re-expansion.
 */
export class FrozenClip {
    constructor(
        public readonly clipNode: ClipNode,
        public readonly options: FreezeOptions
    ) {}

    /**
     * Get the total duration of the frozen clip in beats.
     */
    get duration(): number {
        const noteOps = this.clipNode.operations.filter(op => op.kind === 'note');
        if (noteOps.length === 0) return 0;
        return noteOps.reduce((max, op) => {
            if (op.kind === 'note') {
                return Math.max(max, op.tick + op.duration);
            }
            return max;
        }, 0);
    }

    /**
     * Get the number of notes in the frozen clip.
     */
    get noteCount(): number {
        return this.clipNode.operations.filter(op => op.kind === 'note').length;
    }
}
