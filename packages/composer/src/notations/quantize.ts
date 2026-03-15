import { QuantizationBuilder } from '../builders/QuantizationBuilder'

export function quantize(
  grid?: number,      // grid size in ticks
  strength?: number,  // 0.0 = no quantize, 1.0 = full snap
): QuantizationBuilder {
  return new QuantizationBuilder({
    grid,
    strength,
  })
}
