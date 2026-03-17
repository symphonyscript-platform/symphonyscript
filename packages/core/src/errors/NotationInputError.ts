/**
 * Thrown when a Notation input is invalid.
 */
export class NotationInputError extends Error {
  readonly notationId: string
  readonly method: string

  constructor(notationId: string, method: string, input: string, detail?: string) {
    const msg = detail
      ? `${detail} (${notationId}.${method}, input: '${input}')`
      : `Invalid input '${input}' for ${notationId}.${method}()`
    super(msg)
    this.name = 'NotationInputError'
    this.notationId = notationId
    this.method = method
  }
}
