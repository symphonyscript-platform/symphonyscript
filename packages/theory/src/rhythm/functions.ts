/**
 * Euclidean rhythm generation and pattern utilities.
 */

/**
 * Bjorklund's algorithm for Euclidean rhythms.
 * Distributes k pulses evenly over n steps.
 *
 * @param hits - Number of pulses (k)
 * @param steps - Total steps (n)
 * @returns Boolean array where true = hit, or null if invalid input
 */
export function euclidean(hits: number, steps: number): boolean[] | null {
  if (!Number.isFinite(hits) || !Number.isFinite(steps)) return null
  if (steps <= 0) return null
  if (hits < 0) return null

  if (hits >= steps) {
    const result: boolean[] = new Array(steps)
    for (let i = 0; i < steps; ++i) result[i] = true
    return result
  }
  if (hits <= 0) {
    const result: boolean[] = new Array(steps)
    for (let i = 0; i < steps; ++i) result[i] = false
    return result
  }

  let pattern: number[][] = new Array(hits)
  let remainder: number[][] = new Array(steps - hits)

  for (let i = 0; i < hits; ++i) pattern[i] = [1]
  for (let i = 0; i < steps - hits; ++i) remainder[i] = [0]

  while (remainder.length > 1) {
    const minLen = Math.min(pattern.length, remainder.length)
    const newPattern: number[][] = new Array(minLen)

    for (let i = 0; i < minLen; ++i) {
      const p = pattern[i]
      const r = remainder[i]
      const merged = new Array(p.length + r.length)
      for (let j = 0; j < p.length; ++j) merged[j] = p[j]
      for (let j = 0; j < r.length; ++j) merged[p.length + j] = r[j]
      newPattern[i] = merged
    }

    const leftoverPattern = pattern.slice(minLen)
    const leftoverRemainder = remainder.slice(minLen)

    pattern = newPattern
    remainder = leftoverPattern.length > 0 ? leftoverPattern : leftoverRemainder
  }

  // Flatten
  let totalLen = 0
  for (let i = 0; i < pattern.length; ++i) totalLen += pattern[i].length
  for (let i = 0; i < remainder.length; ++i) totalLen += remainder[i].length

  const flat: boolean[] = new Array(totalLen)
  let idx = 0
  for (let i = 0; i < pattern.length; ++i) {
    const seg = pattern[i]
    for (let j = 0; j < seg.length; ++j) flat[idx++] = seg[j] === 1
  }
  for (let i = 0; i < remainder.length; ++i) {
    const seg = remainder[i]
    for (let j = 0; j < seg.length; ++j) flat[idx++] = seg[j] === 1
  }

  return flat
}

/**
 * Rotate pattern by offset steps.
 * Positive = rotate right, negative = rotate left.
 *
 * @param pattern - Boolean pattern array
 * @param offset - Steps to rotate
 * @returns Rotated pattern
 */
export function rotatePattern(pattern: boolean[], offset: number): boolean[] {
  const len = pattern.length
  if (len === 0) return pattern

  const normalizedOffset = ((offset % len) + len) % len
  if (normalizedOffset === 0) return pattern.slice()

  const result = new Array(len)
  for (let i = 0; i < len; ++i) {
    result[i] = pattern[(i - normalizedOffset + len) % len]
  }
  return result
}

/**
 * Convert boolean pattern to string visualization.
 *
 * @param pattern - Boolean pattern array
 * @param hitChar - Character for hits (default 'x')
 * @param restChar - Character for rests (default '-')
 * @returns String visualization
 */
export function patternToString(
  pattern: boolean[],
  hitChar: string = 'x',
  restChar: string = '-',
): string {
  let result = ''
  for (let i = 0; i < pattern.length; ++i) {
    result += pattern[i] ? hitChar : restChar
  }
  return result
}
