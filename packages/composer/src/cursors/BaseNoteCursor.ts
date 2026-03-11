import { SynapticCursor } from './SynapticCursor';
import { SynapticClip } from '../clips/SynapticClip';
import { SiliconBridge } from '@symphonyscript/kernel';

/**
 * Base note cursor with typed clip reference.
 * Task 061: Parallel hierarchy - each clip type has a corresponding cursor type.
 * Common modifiers inherited from SynapticCursor; commit() delegated to subclasses.
 */
export abstract class BaseNoteCursor<TClip extends SynapticClip> extends SynapticCursor {
    constructor(clip: TClip, bridge: SiliconBridge) {
        super(clip, bridge);
    }

    /** Typed clip access for subclasses returning clip-specific types */
    protected get typedClip(): TClip {
        return this.clip as TClip;
    }
}
