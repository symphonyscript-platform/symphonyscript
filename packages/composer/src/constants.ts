/**
 * Knuth multiplicative hash constant (2^32 / phi, phi ≈ 1.618).
 *
 * Used to derive deterministic seeds from tick positions when no RNG is provided.
 * Formula: `(tick * KNUTH_MULTIPLIER) | 0` yields a good spread for
 * {@link SeededRandom} in builders such as {@link ChanceBuilder}, {@link GrooveBuilder},
 * and {@link HumanizationBuilder}.
 */
export const KNUTH_MULTIPLIER = 2654435761
