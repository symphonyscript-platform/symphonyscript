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
export class KeyboardBuilder extends SynapticMelody {
    private ccOperations: CCOperation[] = [];

    constructor(bridge: SiliconBridge) {
        super(bridge);
    }

    /**
     * Press sustain pedal (CC64 = 127).
     * Notes played after this will sustain until release() is called.
     */
    sustain(): this {
        this.ccOperations.push({
            kind: 'cc',
            controller: 64,
            value: 127,
            tick: this.getCurrentTick()
        });
        return this;
    }

    /**
     * Release sustain pedal (CC64 = 0).
     * Sustained notes will be released.
     */
    release(): this {
        this.ccOperations.push({
            kind: 'cc',
            controller: 64,
            value: 0,
            tick: this.getCurrentTick()
        });
        return this;
    }

    /**
     * Build and return the ClipNode AST structure.
     * Includes both note operations and CC operations.
     */
    override build() {
        const baseClip = super.build();
        return {
            ...baseClip,
            operations: [...baseClip.operations, ...this.ccOperations]
        };
    }
}
