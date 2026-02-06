import { ClipNode, FreezeOptions, ClipOperation, OperationsSource } from '../types';
/**
 * A frozen (pre-compiled) clip for efficient reuse.
 * Frozen clips can be played multiple times without re-expansion.
 * Implements OperationsSource for use with loop() and play().
 */
export declare class FrozenClip implements OperationsSource {
    readonly clipNode: ClipNode;
    readonly options: FreezeOptions;
    constructor(clipNode: ClipNode, options: FreezeOptions);
    /**
     * Get the total duration of the frozen clip in beats.
     */
    get duration(): number;
    /**
     * Get the number of notes in the frozen clip.
     */
    get noteCount(): number;
    /**
     * Returns the frozen operations array.
     * Implements OperationsSource interface for use with loop() and play().
     * @returns Array of operations (shallow copy for safety)
     */
    toOperations(): ClipOperation[];
}
//# sourceMappingURL=FrozenClip.d.ts.map