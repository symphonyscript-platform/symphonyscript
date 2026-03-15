import { SynapticMelody } from './SynapticMelody'
import { SiliconBridge } from '@symphonyscript/kernel'

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
export class WindBuilder extends SynapticMelody {
    constructor(bridge: SiliconBridge) {
        super(bridge);
    }

    /**
     * Set breath controller (CC2).
     * Controls breath pressure for wind instruments.
     * @param amount - Normalized breath amount (0-1)
     * @throws Error if amount is outside 0-1 range
     */
    breath(amount: number): this {
        if (amount < 0 || amount > 1) {
            throw new Error(`breath() amount must be 0-1, got ${amount}`);
        }
        this.control(2, Math.floor(amount * 127));
        return this;
    }

    /**
     * Set expression controller (CC11).
     * Controls overall expression/dynamics for wind instruments.
     * @param amount - Normalized expression amount (0-1)
     * @throws Error if amount is outside 0-1 range
     */
    expressionCC(amount: number): this {
        if (amount < 0 || amount > 1) {
            throw new Error(`expressionCC() amount must be 0-1, got ${amount}`);
        }
        this.control(11, Math.floor(amount * 127));
        return this;
    }
}
