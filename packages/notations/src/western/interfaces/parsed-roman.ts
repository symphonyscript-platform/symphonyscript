export interface ParsedRoman {
  /** Leading accidental: 'b', '#', or '' */
  readonly accidental: string
  /** Roman numeral stem, original case (e.g. 'IV', 'vi') */
  readonly degree: string
  /** Whether the stem is all-lowercase */
  readonly isLowercase: boolean
  /** Remaining suffix after the stem (e.g. '7', 'maj7', 'dim') */
  readonly suffix: string
}
