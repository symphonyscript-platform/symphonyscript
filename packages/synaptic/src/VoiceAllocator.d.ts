import { type HarmonyMask } from '@symphonyscript/theory';
/**
 * VoiceAllocator
 *
 * Bridges music theory (HarmonyMasks) and silicon execution (Nodes).
 * Implements MPE Channel Rotation for true polyphonic voice assignment.
 */
export declare class VoiceAllocator {
    private static nextChannel;
    /**
     * Allocate voices for a harmony mask using pure integer arithmetic.
     *
     * @param mask - 24-bit HarmonyMask integer
     * @param root - MIDI root pitch
     * @param callback - Function to create note with pitch and assigned MPE expression ID
     */
    static allocate(mask: HarmonyMask, root: number, callback: (pitch: number, expressionId: number) => void): void;
    /**
     * Reset the channel rotation counter.
     */
    static reset(): void;
}
//# sourceMappingURL=VoiceAllocator.d.ts.map