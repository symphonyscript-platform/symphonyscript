import type { RomanNumeral } from '@symphonyscript/theory'
import { VoiceLeadBuilder } from '../builders/VoiceLeadBuilder'

/** Voice-led chord progression from roman numerals. */
export function voiceLead(numerals: RomanNumeral[], duration?: number): VoiceLeadBuilder {
  return new VoiceLeadBuilder({ numerals, duration })
}
