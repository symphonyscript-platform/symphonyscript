/**
 * RFC-047: Groove Templates (24-EDO Native)
 *
 * Micro-timing and velocity adjustments for humanized rhythmic feel.
 * Includes kernel-safe primitive accessors for real-time processing.
 */
/**
 * Individual step in a groove pattern.
 */
export interface GrooveStep {
    /** Timing offset as ratio of step duration (-1.0 to 1.0) */
    readonly timing?: number;
    /** Velocity multiplier (0.0 to 2.0) */
    readonly velocity?: number;
    /** Duration multiplier (0.0 to 2.0) */
    readonly duration?: number;
}
/**
 * Groove template for micro-timing adjustments.
 */
export interface GrooveTemplate {
    readonly name: string;
    readonly stepsPerBeat: number;
    readonly steps: readonly GrooveStep[];
}
/**
 * Creates an MPC-style swing groove.
 * COMPOSER-ONLY: Allocates template object.
 *
 * @param amount - Swing amount: 0.5 (straight/50%) to 0.75 (dotted/75%)
 * @param stepsPerBeat - Grid resolution (default 4 = 16th notes)
 * @returns GrooveTemplate with swing applied
 */
export declare function createSwing(amount: number, stepsPerBeat?: number): GrooveTemplate;
/**
 * Standard groove templates.
 * KERNEL-SAFE: Frozen constants.
 */
export declare const GROOVE: {
    /** Straight timing (no groove) */
    readonly STRAIGHT: GrooveTemplate;
    /** Classic MPC 55% Swing (16th notes) */
    readonly MPC_16_55: GrooveTemplate;
    /** Classic MPC 57% Swing (16th notes) */
    readonly MPC_16_57: GrooveTemplate;
    /** Classic MPC 60% Swing (16th notes) */
    readonly MPC_16_60: GrooveTemplate;
    /** Classic MPC 66% Triplet Swing (16th notes) */
    readonly MPC_16_66: GrooveTemplate;
    /** Hard Swing (dotted 16th feel) */
    readonly MPC_16_75: GrooveTemplate;
    /** Basic Swing (approx 66% swing ratio) - gives a triplet feel */
    readonly SWING: GrooveTemplate;
    /** Delayed backbeat feel - creates a relaxed vibe */
    readonly LAID_BACK: GrooveTemplate;
    /** Rushing feel - creates urgency */
    readonly RUSHING: GrooveTemplate;
};
/**
 * Apply groove to a step position.
 * COMPOSER-ONLY: Allocates object on each call.
 *
 * @param step - Step index in the pattern
 * @param template - Groove template to apply
 * @param baseVelocity - Base velocity multiplier (default 1.0)
 * @returns Object with timing offset and velocity
 */
export declare function applyGroove(step: number, template: GrooveTemplate, baseVelocity?: number): {
    timing: number;
    velocity: number;
};
/**
 * Get groove timing offset for a step.
 * KERNEL-SAFE: Returns primitive (no allocation).
 *
 * @param step - Step index in the pattern
 * @param template - Groove template to apply
 * @returns Timing offset (-1.0 to 1.0)
 */
export declare function getGrooveTiming(step: number, template: GrooveTemplate): number;
/**
 * Get groove velocity multiplier for a step.
 * KERNEL-SAFE: Returns primitive (no allocation).
 *
 * @param step - Step index in the pattern
 * @param template - Groove template to apply
 * @param baseVelocity - Base velocity multiplier (default 1.0)
 * @returns Velocity multiplier
 */
export declare function getGrooveVelocity(step: number, template: GrooveTemplate, baseVelocity?: number): number;
/**
 * Get groove duration multiplier for a step.
 * KERNEL-SAFE: Returns primitive (no allocation).
 *
 * @param step - Step index in the pattern
 * @param template - Groove template to apply
 * @param baseDuration - Base duration multiplier (default 1.0)
 * @returns Duration multiplier
 */
export declare function getGrooveDuration(step: number, template: GrooveTemplate, baseDuration?: number): number;
//# sourceMappingURL=grooves.d.ts.map