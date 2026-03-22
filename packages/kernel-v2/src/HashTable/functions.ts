export function fibonacciHash(key: number, shift: number) {
  return ((key * 2654435769) >>> shift)
}
