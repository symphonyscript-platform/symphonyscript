# Directive: Task 037

Implement `preview()` ASCII visualization per `research/workflow/tasks/037-2026-02-03-implement-preview.md`

## Expectations

- Implement `preview(bpm?: number): this` on SynapticClip
- Default BPM: 120
- Build clip internally, render ASCII grid
- Grid format:
  ```
  Clip: <name> (<bpm> BPM)
  Beat: |1---2---3---4---|1---2---3---4---|
  C4:   |X...X...........|................|
  E4:   |....X...........|................|
  ```
- Each `-` = 1/16th note (4 per beat)
- `X` = note onset, `.` = sustain or empty
- Pitches sorted high to low
- Use `console.log` for output
- Return `this` for chaining
- For drums: show drum names instead of pitches

## Files

- `packages/composer/src/clips/SynapticClip.ts` (add preview method)
- `packages/composer/src/__tests__/Preview.test.ts` (create, use jest spyOn for console.log)
