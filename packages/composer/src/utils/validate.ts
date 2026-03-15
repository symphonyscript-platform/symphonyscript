/**
 * Validation utilities for composition API inputs.
 *
 * All validators throw on invalid input (fail-fast at construction time).
 */

export function assertRange(name: string, value: number, min: number, max: number): void {
  if (value < min || value > max) {
    throw new RangeError(`${name} must be between ${min} and ${max}, got ${value}`)
  }
}

export function assertPositive(name: string, value: number): void {
  if (value <= 0) {
    throw new RangeError(`${name} must be positive, got ${value}`)
  }
}

export function assertNonNegative(name: string, value: number): void {
  if (value < 0) {
    throw new RangeError(`${name} must be non-negative, got ${value}`)
  }
}

export function assertInteger(name: string, value: number): void {
  if (!Number.isInteger(value)) {
    throw new TypeError(`${name} must be an integer, got ${value}`)
  }
}
