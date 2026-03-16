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
export class SeededRandom {
  private state: number;

  /**
   * Create a new SeededRandom generator.
   * COMPOSER-ONLY: Object creation.
   *
   * @param seed - Initial seed value
   */
  constructor(seed: number) {
    this.state = seed >>> 0; // Ensure unsigned 32-bit
  }

  /**
   * Get next random float in [0, 1).
   * KERNEL-SAFE: Pure arithmetic (but mutates internal state).
   *
   * @returns Random float in [0, 1)
   */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Get random float in [min, max).
   * KERNEL-SAFE: Pure arithmetic (but mutates internal state).
   *
   * @param min - Minimum value (inclusive)
   * @param max - Maximum value (exclusive)

   * @returns Random float in [min, max)
   */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /**
   * Get random integer in [min, max].
   * KERNEL-SAFE: Pure arithmetic (but mutates internal state).
   *
   * @param min - Minimum value (inclusive)
   * @param max - Maximum value (inclusive)

   * @returns Random integer in [min, max]
   */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /**
   * Pick a random element from an array.
   * KERNEL-SAFE: No allocation (but mutates internal state).
   *
   * @param array - Array to pick from

   * @returns Random element or undefined if empty
   */
  pick<T>(array: readonly T[]): T | undefined {
    if (array.length === 0) return undefined;
    return array[this.int(0, array.length - 1)];
  }

  /**
   * Shuffle array in place using Fisher-Yates.
   * COMPOSER-ONLY: Mutates input array.
   *
   * @param array - Array to shuffle (mutated in place)

   * @returns The same array, shuffled
   */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Create a shuffled copy of an array.
   * COMPOSER-ONLY: Allocates new array.
   *
   * @param array - Array to shuffle

   * @returns New shuffled array
   */
  shuffled<T>(array: readonly T[]): T[] {
    return this.shuffle([...array]);
  }

  /**
   * Get random boolean with given probability.
   * KERNEL-SAFE: Pure arithmetic (but mutates internal state).
   *
   * @param probability - Probability of true (0-1, default 0.5)

   * @returns Random boolean
   */
  bool(probability: number = 0.5): boolean {
    return this.next() < probability;
  }

  /**
   * Get random value from weighted options.
   * COMPOSER-ONLY: Iterates array.
   *
   * @param options - Array of [value, weight] pairs

   * @returns Random value based on weights, or undefined if empty
   */
  weighted<T>(options: readonly [T, number][]): T | undefined {
    if (options.length === 0) return undefined;

    const totalWeight = options.reduce((sum, [, w]) => sum + w, 0);
    if (totalWeight <= 0) return options[0]?.[0];

    let random = this.next() * totalWeight;
    for (const [value, weight] of options) {
      random -= weight;
      if (random <= 0) return value;
    }

    return options[options.length - 1]?.[0];
  }

  /**
   * Fork this generator (create independent child with derived seed).
   * COMPOSER-ONLY: Creates new object.
   *
   * @returns New SeededRandom with derived seed
   */
  fork(): SeededRandom {
    return new SeededRandom(this.state ^ 0x5deece66d);
  }

  /**
   * Get the current internal state (for serialization).
   * KERNEL-SAFE: Pure read.
   *
   * @returns Current state value
   */
  getState(): number {
    return this.state;
  }

  /**
   * Set the internal state (for deserialization).
   * KERNEL-SAFE: Pure write.
   *
   * @param state - State value to restore
   */
  setState(state: number): void {
    this.state = state >>> 0;
  }
}

/**
 * Create a seeded random generator.
 * COMPOSER-ONLY: Object creation.
 *
 * @param seed - Seed value (defaults to Date.now())

 * @returns New SeededRandom instance
 */
export function createRandom(seed?: number): SeededRandom {
  return new SeededRandom(seed ?? Date.now());
}

/**
 * Hash a string to a number (for seed generation).
 * KERNEL-SAFE: Pure computation.
 *
 * @param str - String to hash

 * @returns Unsigned 32-bit hash value
 */
export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash >>> 0; // Ensure unsigned
}

/**
 * Generate a random seed from multiple values.
 * KERNEL-SAFE: Pure computation.
 *
 * @param values - Values to combine into seed

 * @returns Combined seed value
 */
export function combineSeed(...values: (string | number)[]): number {
  let seed = 0;
  for (const value of values) {
    if (typeof value === 'string') {
      seed ^= hashString(value);
    } else {
      seed ^= value >>> 0;
    }
    // Mix bits
    seed = Math.imul(seed ^ (seed >>> 16), 0x85ebca6b);
    seed = Math.imul(seed ^ (seed >>> 13), 0xc2b2ae35);
    seed ^= seed >>> 16;
  }
  return seed >>> 0;
}
