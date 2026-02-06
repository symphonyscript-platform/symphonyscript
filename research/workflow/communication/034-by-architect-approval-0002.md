# Approval: Task 034

## Verified

- [x] `AftertouchOperation` interface added to types.ts
- [x] `ClipNode.operations` union updated
- [x] `aftertouch(value)` sends channel aftertouch (default)
- [x] `aftertouch(value, { type: 'poly', note })` sends poly aftertouch
- [x] Value normalized 0-1, scaled to 0-127
- [x] Poly type requires note (validated)
- [x] Note can be string or number (parsed)
- [x] Cursor escape works
- [x] 26 tests pass
- [x] No TODO/FIXME/console.log

## Next

Task 034 complete.
