/**
 * Validation utilities for composition API inputs.
 *
 * All validators throw on invalid input (fail-fast at construction time).
 */

/**
 * Assert that a numeric value lies within an inclusive range.
 *
 * @param name - Parameter name for error messages (e.g. `"velocity"`, `"ticks"`).
 * @param value - Value to validate.
 * @param min - Inclusive lower bound.
 * @param max - Inclusive upper bound.
 * @throws {@link RangeError} When `value < min` or `value > max`. Message format:
 *         `"${name} must be between ${min} and ${max}, got ${value}"`.
 */
export function assertRange(name: string, value: number, min: number, max: number): void {
  if (value < min || value > max) {
    throw new RangeError(`${name} must be between ${min} and ${max}, got ${value}`)
  }
}

/**
 * Assert that a numeric value is strictly greater than zero.
 *
 * @param name - Parameter name for error messages (e.g. `"velocity"`, `"duration"`).
 * @param value - Value to validate.
 * @throws {@link RangeError} When `value <= 0`. Message format:
 *         `"${name} must be positive, got ${value}"`.
 */
export function assertPositive(name: string, value: number): void {
  if (value <= 0) {
    throw new RangeError(`${name} must be positive, got ${value}`)
  }
}

/**
 * Assert that a numeric value is greater than or equal to zero.
 *
 * @param name - Parameter name for error messages (e.g. `"velocity"`, `"ticks"`).
 * @param value - Value to validate.
 * @throws {@link RangeError} When `value < 0`. Message format:
 *         `"${name} must be non-negative, got ${value}"`.
 */
export function assertNonNegative(name: string, value: number): void {
  if (value < 0) {
    throw new RangeError(`${name} must be non-negative, got ${value}`)
  }
}

/**
 * Assert that a numeric value is an integer.
 *
 * @param name - Parameter name for error messages (e.g. `"ticks"`, `"channel"`).
 * @param value - Value to validate.
 * @throws {@link TypeError} When `value` is not an integer (includes NaN, Infinity).
 *         Message format: `"${name} must be an integer, got ${value}"`.
 */
export function assertInteger(name: string, value: number): void {
  if (!Number.isInteger(value)) {
    throw new TypeError(`${name} must be an integer, got ${value}`)
  }
}
