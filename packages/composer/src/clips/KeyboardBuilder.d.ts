import { SynapticMelody } from './SynapticMelody';
import { SiliconBridge } from '@symphonyscript/kernel';
import { CCOperation } from '../types';
/**
 * KeyboardBuilder - Piano/keyboard instrument builder with sustain pedal support.
 *
 * Extends SynapticMelody with sustain pedal control (CC64).
 *
 * Usage:
 * ```typescript
 * const piano = Clip.keyboard('Piano')
 *   .sustain()
 *   .chord('Cmaj').commit()
 *   .release()
 * ```
 */
export declare class KeyboardBuilder extends SynapticMelody {
    private ccOperations;
    constructor(bridge: SiliconBridge);
    /**
     * Press sustain pedal (CC64 = 127).
     * Notes played after this will sustain until release() is called.
     */
    sustain(): this;
    /**
     * Release sustain pedal (CC64 = 0).
     * Sustained notes will be released.
     */
    release(): this;
    /**
     * Build and return the ClipNode AST structure.
     * Includes both note operations and CC operations.
     */
    build(): {
        operations: (import("..").NoteOperation | import("..").LoopOp | import("..").ClipOp | CCOperation)[];
        _version: number;
        kind: "clip";
        name: string;
        tempo?: number;
        timeSignature?: [number, number];
        swing?: number;
        groove?: string | null;
    };
}
//# sourceMappingURL=KeyboardBuilder.d.ts.map