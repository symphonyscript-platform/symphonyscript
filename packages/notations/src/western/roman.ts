/**
 * RFC-047: Roman Numeral Types & Constants (24-EDO Native)
 *
 * Type-safe roman numeral identifiers and their scale degree mappings.
 */

// ============================================================================
// SECTION 1: Roman Numeral Type
// ============================================================================

/**
 * Roman numeral chord symbols.
 * Uppercase = major quality, lowercase = minor quality (determined by scale).
 * Suffix '7' = seventh chord extension.
 */
export type RomanNumeral =
  | 'I' | 'i' | 'II' | 'ii' | 'III' | 'iii' | 'IV' | 'iv'
  | 'V' | 'v' | 'VI' | 'vi' | 'VII' | 'vii'
  | 'I7' | 'i7' | 'II7' | 'ii7' | 'III7' | 'iii7' | 'IV7' | 'iv7'
  | 'V7' | 'v7' | 'VI7' | 'vi7' | 'VII7' | 'vii7'

// ============================================================================
// SECTION 2: Roman Numeral → Scale Degree Mapping
// ============================================================================

/**
 * Maps roman numerals to their constituent scale degrees.
 * Both upper and lowercase map to the same degrees — quality is determined
 * by the scale context, not the numeral case.
 *
 * Degrees are 1-indexed. Values above 7 represent compound intervals
 * (e.g., 8 = octave of 1, 9 = octave of 2).
 */
export const ROMAN_DEGREE_MAP: Readonly<Record<RomanNumeral, readonly number[]>> = {
  'I': [1, 3, 5], 'i': [1, 3, 5],
  'II': [2, 4, 6], 'ii': [2, 4, 6],
  'III': [3, 5, 7], 'iii': [3, 5, 7],
  'IV': [4, 6, 8], 'iv': [4, 6, 8],
  'V': [5, 7, 9], 'v': [5, 7, 9],
  'VI': [6, 8, 10], 'vi': [6, 8, 10],
  'VII': [7, 9, 11], 'vii': [7, 9, 11],
  'I7': [1, 3, 5, 7], 'i7': [1, 3, 5, 7],
  'II7': [2, 4, 6, 8], 'ii7': [2, 4, 6, 8],
  'III7': [3, 5, 7, 9], 'iii7': [3, 5, 7, 9],
  'IV7': [4, 6, 8, 10], 'iv7': [4, 6, 8, 10],
  'V7': [5, 7, 9, 11], 'v7': [5, 7, 9, 11],
  'VI7': [6, 8, 10, 12], 'vi7': [6, 8, 10, 12],
  'VII7': [7, 9, 11, 13], 'vii7': [7, 9, 11, 13],
}
