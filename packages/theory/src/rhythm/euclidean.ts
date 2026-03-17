/**
 * RFC-047: Euclidean Rhythm Generator
 *
 * Bjorklund's algorithm for generating evenly-distributed rhythmic patterns.
 */

// ============================================================================
// SECTION 1: Core Euclidean Algorithm
// ============================================================================

/**
 * Bjorklund's algorithm for Euclidean rhythms.
 * Distributes k pulses evenly over n steps.
 *
 * COMPOSER-ONLY: Allocates arrays.
 *
 * @param hits - Number of pulses (k)
 * @param steps - Total steps (n)
 *
 * @returns Boolean array where true = hit, or null if invalid input
 */
export function euclidean(hits: number, steps: number): boolean[] | null {
    // Validate inputs
    if (!Number.isFinite(hits) || !Number.isFinite(steps)) return null;
    if (steps <= 0) return null;
    if (hits < 0) return null;

    // Edge cases
    if (hits >= steps) return Array(steps).fill(true);
    if (hits <= 0) return Array(steps).fill(false);

    // Bjorklund's algorithm
    let pattern: number[][] = [];
    let remainder: number[][] = [];

    for (let i = 0; i < hits; i++) pattern.push([1]);
    for (let i = 0; i < steps - hits; i++) remainder.push([0]);

    while (remainder.length > 1) {
        const newPattern: number[][] = [];
        const minLen = Math.min(pattern.length, remainder.length);

        for (let i = 0; i < minLen; i++) {
            newPattern.push([...pattern[i], ...remainder[i]]);
        }

        const leftoverPattern = pattern.slice(minLen);
        const leftoverRemainder = remainder.slice(minLen);

        pattern = newPattern;
        remainder = leftoverPattern.length > 0 ? leftoverPattern : leftoverRemainder;
    }

    // Flatten and convert to boolean
    const flat = [...pattern, ...remainder].flat();
    return flat.map(v => v === 1);
}

// ============================================================================
// SECTION 2: Pattern Rotation
// ============================================================================

/**
 * Rotate pattern by offset steps.
 * Positive = rotate right, Negative = rotate left.
 *
 * COMPOSER-ONLY: Allocates new array.
 *
 * @param pattern - Boolean pattern array
 * @param offset - Steps to rotate
 *
 * @returns Rotated pattern
 */
export function rotatePattern(pattern: boolean[], offset: number): boolean[] {
    if (pattern.length === 0) return pattern;
    const normalizedOffset = ((offset % pattern.length) + pattern.length) % pattern.length;
    return [
        ...pattern.slice(-normalizedOffset),
        ...pattern.slice(0, -normalizedOffset || pattern.length)
    ];
}

// ============================================================================
// SECTION 3: Pattern Visualization
// ============================================================================

/**
 * Convert boolean pattern to string visualization.
 * COMPOSER-ONLY: String allocation.
 *
 * @param pattern - Boolean pattern array
 * @param hitChar - Character for hits (default 'x')
 * @param restChar - Character for rests (default '-')
 *
 * @returns String visualization
 */
export function patternToString(
    pattern: boolean[],
    hitChar: string = 'x',
    restChar: string = '-'
): string {
    return pattern.map(hit => hit ? hitChar : restChar).join('');
}
