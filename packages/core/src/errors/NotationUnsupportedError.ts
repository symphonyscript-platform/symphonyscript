/**
 * Thrown when a Notation method is called that the notation does not support.
 * Check `notation.getCapabilities()` before calling capability-gated methods.
 */
export class NotationUnsupportedError extends Error {
  readonly notationId: string
  readonly method: string

  constructor(notationId: string, method: string) {
    super(`'${notationId}' notation does not support ${method}()`)
    this.name = 'NotationUnsupportedError'
    this.notationId = notationId
    this.method = method
  }
}
