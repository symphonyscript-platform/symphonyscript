/**
 * RFC-047: Seeded Random (24-EDO Native)
 *
 * Seeded pseudo-random number generator (Mulberry32).
 * Fast, deterministic, good distribution.
 *
 * COMPOSER-ONLY: Class with internal state.
 */
/**
 * Seeded pseudo-random number generator.
 * Uses Mulberry32 algorithm for fast, deterministic random numbers.
 * COMPOSER-ONLY: Class with mutable state.
 */
export declare class SeededRandom {
    private state;
    /**
     * Create a new SeededRandom generator.
     * COMPOSER-ONLY: Object creation.
     *
     * @param seed - Initial seed value
     */
    constructor(seed: number);
    /**
     * Get next random float in [0, 1).
     * KERNEL-SAFE: Pure arithmetic (but mutates internal state).
     *
     * @returns Random float in [0, 1)
     */
    next(): number;
    /**
     * Get random float in [min, max).
     * KERNEL-SAFE: Pure arithmetic (but mutates internal state).
     *
     * @param min - Minimum value (inclusive)
     * @param max - Maximum value (exclusive)
     * @returns Random float in [min, max)
     */
    range(min: number, max: number): number;
    /**
     * Get random integer in [min, max].
     * KERNEL-SAFE: Pure arithmetic (but mutates internal state).
     *
     * @param min - Minimum value (inclusive)
     * @param max - Maximum value (inclusive)
     * @returns Random integer in [min, max]
     */
    int(min: number, max: number): number;
    /**
     * Pick a random element from an array.
     * KERNEL-SAFE: No allocation (but mutates internal state).
     *
     * @param array - Array to pick from
     * @returns Random element or undefined if empty
     */
    pick<T>(array: readonly T[]): T | undefined;
    /**
     * Shuffle array in place using Fisher-Yates.
     * COMPOSER-ONLY: Mutates input array.
     *
     * @param array - Array to shuffle (mutated in place)
     * @returns The same array, shuffled
     */
    shuffle<T>(array: T[]): T[];
    /**
     * Create a shuffled copy of an array.
     * COMPOSER-ONLY: Allocates new array.
     *
     * @param array - Array to shuffle
     * @returns New shuffled array
     */
    shuffled<T>(array: readonly T[]): T[];
    /**
     * Get random boolean with given probability.
     * KERNEL-SAFE: Pure arithmetic (but mutates internal state).
     *
     * @param probability - Probability of true (0-1, default 0.5)
     * @returns Random boolean
     */
    bool(probability?: number): boolean;
    /**
     * Get random value from weighted options.
     * COMPOSER-ONLY: Iterates array.
     *
     * @param options - Array of [value, weight] pairs
     * @returns Random value based on weights, or undefined if empty
     */
    weighted<T>(options: readonly [T, number][]): T | undefined;
    /**
     * Fork this generator (create independent child with derived seed).
     * COMPOSER-ONLY: Creates new object.
     *
     * @returns New SeededRandom with derived seed
     */
    fork(): SeededRandom;
    /**
     * Get the current internal state (for serialization).
     * KERNEL-SAFE: Pure read.
     *
     * @returns Current state value
     */
    getState(): number;
    /**
     * Set the internal state (for deserialization).
     * KERNEL-SAFE: Pure write.
     *
     * @param state - State value to restore
     */
    setState(state: number): void;
}
/**
 * Create a seeded random generator.
 * COMPOSER-ONLY: Object creation.
 *
 * @param seed - Seed value (defaults to Date.now())
 * @returns New SeededRandom instance
 */
export declare function createRandom(seed?: number): SeededRandom;
/**
 * Hash a string to a number (for seed generation).
 * KERNEL-SAFE: Pure computation.
 *
 * @param str - String to hash
 * @returns Unsigned 32-bit hash value
 */
export declare function hashString(str: string): number;
/**
 * Generate a random seed from multiple values.
 * KERNEL-SAFE: Pure computation.
 *
 * @param values - Values to combine into seed
 * @returns Combined seed value
 */
export declare function combineSeed(...values: (string | number)[]): number;
//# sourceMappingURL=random.d.ts.map