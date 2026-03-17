/**
 * Thrown when a Notation input is invalid.
 */
export class NotationInputError extends Error {
  readonly notationId: string
  readonly method: string

  constructor(notationId: string, method: string, input: string) {
    super(`Invalid input '${input}' for ${notationId}.${method}()`)
    this.name = 'NotationInputError'
    this.notationId = notationId
    this.method = method
  }
}
