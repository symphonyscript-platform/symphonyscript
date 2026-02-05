/**
 * Seeded pseudo-random number generator (Mulberry32).
 * Fast, deterministic, good distribution.
 */
export declare class SeededRandom {
    private state;
    constructor(seed: number);
    /**
     * Get next random float in [0, 1).
     */
    next(): number;
    /**
     * Get random float in [min, max).
     */
    range(min: number, max: number): number;
    /**
     * Get random integer in [min, max].
     */
    int(min: number, max: number): number;
    /**
     * Shuffle array in place using Fisher-Yates.
     */
    shuffle<T>(array: T[]): T[];
    /**
     * Fork this generator (create independent child with derived seed).
     */
    fork(): SeededRandom;
}
/**
 * Create a seeded random generator.
 * If no seed provided, uses a hash of current time (still deterministic within session).
 */
export declare function createRandom(seed?: number): SeededRandom;
/**
 * Hash a string to a number (for seed generation).
 */
export declare function hashString(str: string): number;
//# sourceMappingURL=random.d.ts.map