import { SynapticMelody } from './SynapticMelody'
import { SiliconBridge } from '@symphonyscript/kernel'

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
    constructor(bridge: SiliconBridge) {
        super(bridge);
    }

    /**
     * Press sustain pedal (CC64 = 127).
     * Notes played after this will sustain until release() is called.
     */
    sustain(): this {
        this.control(64, 127);
        return this;
    }

    /**
     * Release sustain pedal (CC64 = 0).
     * Sustained notes will be released.
     */
    release(): this {
        this.control(64, 0);
        return this;
    }
}
