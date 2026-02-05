import { SynapticGrooveBuilder, GrooveTemplate } from './SynapticGrooveBuilder';
/**
 * GrooveStepCursor
 * Helper for configuring individual steps in the GrooveBuilder chain.
 */
export declare class GrooveStepCursor {
    private builder;
    private index;
    constructor(builder: SynapticGrooveBuilder);
    bind(index: number): this;
    velocity(val: number): this;
    duration(val: number): this;
    timing(offset: number): this;
    probability(p: number): this;
    /**
     * Commits current step and starts the next one.
     */
    step(timing?: number): this;
    /**
     * Finalizes the groove and returns the template.
     */
    freeze(): GrooveTemplate;
}
//# sourceMappingURL=GrooveStepCursor.d.ts.map