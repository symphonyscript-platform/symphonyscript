import { SynapticMelody } from './SynapticMelody';
import { SiliconBridge } from '@symphonyscript/kernel';
import { CCOperation } from '../types';
/**
 * WindBuilder - Wind instrument builder with breath control support.
 *
 * Extends SynapticMelody with breath controller (CC2) and expression (CC11).
 *
 * Usage:
 * ```typescript
 * const flute = Clip.wind('Flute')
 *   .breath(0.8)
 *   .note('C5', 1).commit()
 *   .expressionCC(0.6)
 *   .note('D5', 1).commit()
 * ```
 */
export declare class WindBuilder extends SynapticMelody {
    private ccOperations;
    constructor(bridge: SiliconBridge);
    /**
     * Set breath controller (CC2).
     * Controls breath pressure for wind instruments.
     * @param amount - Normalized breath amount (0-1)
     * @throws Error if amount is outside 0-1 range
     */
    breath(amount: number): this;
    /**
     * Set expression controller (CC11).
     * Controls overall expression/dynamics for wind instruments.
     * @param amount - Normalized expression amount (0-1)
     * @throws Error if amount is outside 0-1 range
     */
    expressionCC(amount: number): this;
    /**
     * Build and return the ClipNode AST structure.
     * Includes both note operations and CC operations.
     */
    build(): {
        operations: (import("..").NoteOperation | import("..").LoopOp | import("..").ClipOp | CCOperation | import("..").PitchBendOperation)[];
        _version: number;
        kind: "clip";
        name: string;
        tempo?: number;
        timeSignature?: [number, number];
        swing?: number;
        groove?: string | null;
    };
}
//# sourceMappingURL=WindBuilder.d.ts.map