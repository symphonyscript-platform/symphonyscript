/**
 * Duration constants as beat ratios.
 * 1 beat = quarter note. All values relative to one beat.
 */

// --- Standard ---
export const Whole       = 4
export const Half        = 2
export const Quarter     = 1
export const Eighth      = 0.5
export const Sixteenth   = 0.25
export const ThirtySecond = 0.125

// --- Dotted (1.5× standard) ---
export const DottedWhole      = 6
export const DottedHalf       = 3
export const DottedQuarter    = 1.5
export const DottedEighth     = 0.75
export const DottedSixteenth  = 0.375

// --- Triplet (2/3× standard) ---
export const HalfTriplet      = 4 / 3
export const QuarterTriplet   = 2 / 3
export const EighthTriplet    = 1 / 3
export const SixteenthTriplet = 1 / 6
