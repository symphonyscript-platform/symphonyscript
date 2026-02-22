# composer

This library was generated with [Nx](https://nx.dev).

## Design-Time vs Runtime

The composer uses a **design-time** vs **runtime** distinction:

- **Design-time**: Session and Track setup (e.g. `Session.create()`, `Track.from()`, `.tempo()`, `.add()`, `.build()`). These builders allocate arrays and objects; they are meant to run once when composing a session, not during playback.
- **Runtime**: Playback hot paths where performance matters. Do not call Session or Track builder methods from runtime loops.

Classes marked with `@design-time` in JSDoc (e.g. `Session`, `Track`) are safe to allocate during composition but should not be used in hot paths.

## Building

Run `nx build composer` to build the library.

## Running unit tests

Run `nx test composer` to execute the unit tests via [Jest](https://jestjs.io).
