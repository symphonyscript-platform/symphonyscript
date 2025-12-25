/**
 * RFC-047: Type Safety for Bitwise Theory
 * Branded types prevent accidental misuse of raw integers.
 */
/**
 * A 24-bit bitmask representing harmony (chord/scale).
 * MUST be created via pack() or bitwise operations.
 */
export type HarmonyMask = number & {
    readonly __brand: 'HarmonyMask';
};
/**
 * A 24-EDO interval index (0-23).
 * Semantically distinct from MIDI note numbers or raw integers.
 */
export type Interval24EDO = number & {
    readonly __brand: 'Interval24EDO';
};
/**
 * Type guard: Assert a number is a valid HarmonyMask.
 */
export declare function asHarmonyMask(value: number): HarmonyMask;
/**
 * Type guard: Assert a number is a valid Interval24EDO.
 */
export declare function asInterval24EDO(value: number): Interval24EDO;
//# sourceMappingURL=types.d.ts.map