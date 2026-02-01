/**
 * RFC-047: Groove Templates (24-EDO Native)
 *
 * Micro-timing and velocity adjustments for humanized rhythmic feel.
 * Includes kernel-safe primitive accessors for real-time processing.
 */

// ============================================================================
// SECTION 1: Types
// ============================================================================

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

// ============================================================================
// SECTION 2: Groove Creation
// ============================================================================

/**
 * Creates an MPC-style swing groove.
 * COMPOSER-ONLY: Allocates template object.
 *
 * @param amount - Swing amount: 0.5 (straight/50%) to 0.75 (dotted/75%)
 * @param stepsPerBeat - Grid resolution (default 4 = 16th notes)
 * @returns GrooveTemplate with swing applied
 */
export function createSwing(amount: number, stepsPerBeat: number = 4): GrooveTemplate {
    // MPC swing affects every EVEN step (0-indexed odd steps: 1, 3, 5...)
    // amount is the ratio of the FIRST step duration to the total pair duration.
    // 50% = 1:1, 66% = 2:1 (triplet), 75% = 3:1 (dotted)
    // Delay in offsets = (amount - 0.5) * 2.

    const delay = (amount - 0.5) * 2;
    const steps: GrooveStep[] = [];

    for (let i = 0; i < stepsPerBeat; i++) {
        if (i % 2 !== 0) {
            // Odd step (2nd, 4th, etc) - delayed
            steps.push({ timing: delay });
        } else {
            // Even step (1st, 3rd) - on grid
            steps.push({});
        }
    }

    return Object.freeze({
        name: `MPC Swing ${Math.round(amount * 100)}%`,
        stepsPerBeat,
        steps: Object.freeze(steps)
    });
}

// ============================================================================
// SECTION 3: Pre-defined Groove Templates
// ============================================================================

/**
 * Standard groove templates.
 * KERNEL-SAFE: Frozen constants.
 */
export const GROOVE = {
    /** Straight timing (no groove) */
    STRAIGHT: Object.freeze({
        name: 'Straight',
        stepsPerBeat: 4,
        steps: Object.freeze([])
    }) as GrooveTemplate,

    /** Classic MPC 55% Swing (16th notes) */
    MPC_16_55: createSwing(0.55, 4),

    /** Classic MPC 57% Swing (16th notes) */
    MPC_16_57: createSwing(0.57, 4),

    /** Classic MPC 60% Swing (16th notes) */
    MPC_16_60: createSwing(0.60, 4),

    /** Classic MPC 66% Triplet Swing (16th notes) */
    MPC_16_66: createSwing(0.66, 4),

    /** Hard Swing (dotted 16th feel) */
    MPC_16_75: createSwing(0.75, 4),

    /** Basic Swing (approx 66% swing ratio) - gives a triplet feel */
    SWING: Object.freeze({
        name: 'Swing',
        stepsPerBeat: 2,
        steps: Object.freeze([
            { timing: 0 },
            { timing: 0.16 }
        ])
    }) as GrooveTemplate,

    /** Delayed backbeat feel - creates a relaxed vibe */
    LAID_BACK: Object.freeze({
        name: 'Laid Back',
        stepsPerBeat: 1,
        steps: Object.freeze([
            { timing: 0, velocity: 1.0 },
            { timing: 0.02, velocity: 0.9 },
            { timing: 0.05, velocity: 1.1 },
            { timing: 0.02, velocity: 0.9 }
        ])
    }) as GrooveTemplate,

    /** Rushing feel - creates urgency */
    RUSHING: Object.freeze({
        name: 'Rushing',
        stepsPerBeat: 1,
        steps: Object.freeze([
            { timing: 0, velocity: 1.0 },
            { timing: -0.01, velocity: 1.0 },
            { timing: -0.02, velocity: 1.0 },
            { timing: -0.01, velocity: 1.0 }
        ])
    }) as GrooveTemplate,
} as const;

// ============================================================================
// SECTION 4: Groove Application
// ============================================================================

/**
 * Apply groove to a step position.
 * COMPOSER-ONLY: Allocates object on each call.
 *
 * @param step - Step index in the pattern
 * @param template - Groove template to apply
 * @param baseVelocity - Base velocity multiplier (default 1.0)
 * @returns Object with timing offset and velocity
 */
export function applyGroove(
    step: number,
    template: GrooveTemplate,
    baseVelocity: number = 1.0
): { timing: number; velocity: number } {
    if (template.steps.length === 0) {
        return { timing: 0, velocity: baseVelocity };
    }

    const idx = step % template.steps.length;
    const grooveStep = template.steps[idx] ?? {};

    return {
        timing: grooveStep.timing ?? 0,
        velocity: baseVelocity * (grooveStep.velocity ?? 1.0)
    };
}

/**
 * Get groove timing offset for a step.
 * KERNEL-SAFE: Returns primitive (no allocation).
 *
 * @param step - Step index in the pattern
 * @param template - Groove template to apply
 * @returns Timing offset (-1.0 to 1.0)
 */
export function getGrooveTiming(step: number, template: GrooveTemplate): number {
    if (template.steps.length === 0) return 0;

    const idx = step % template.steps.length;
    const grooveStep = template.steps[idx];

    return grooveStep?.timing ?? 0;
}

/**
 * Get groove velocity multiplier for a step.
 * KERNEL-SAFE: Returns primitive (no allocation).
 *
 * @param step - Step index in the pattern
 * @param template - Groove template to apply
 * @param baseVelocity - Base velocity multiplier (default 1.0)
 * @returns Velocity multiplier
 */
export function getGrooveVelocity(
    step: number,
    template: GrooveTemplate,
    baseVelocity: number = 1.0
): number {
    if (template.steps.length === 0) return baseVelocity;

    const idx = step % template.steps.length;
    const grooveStep = template.steps[idx];

    return baseVelocity * (grooveStep?.velocity ?? 1.0);
}

/**
 * Get groove duration multiplier for a step.
 * KERNEL-SAFE: Returns primitive (no allocation).
 *
 * @param step - Step index in the pattern
 * @param template - Groove template to apply
 * @param baseDuration - Base duration multiplier (default 1.0)
 * @returns Duration multiplier
 */
export function getGrooveDuration(
    step: number,
    template: GrooveTemplate,
    baseDuration: number = 1.0
): number {
    if (template.steps.length === 0) return baseDuration;

    const idx = step % template.steps.length;
    const grooveStep = template.steps[idx];

    return baseDuration * (grooveStep?.duration ?? 1.0);
}
