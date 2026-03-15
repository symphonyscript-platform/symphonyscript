import { ArpeggioBuilder } from '../builders/ArpeggioBuilder'
import type { NotePitch } from '../types'

export function arpeggio(pitches?: NotePitch[], rate?: number): ArpeggioBuilder {
  return new ArpeggioBuilder({ pitches, rate })
}
