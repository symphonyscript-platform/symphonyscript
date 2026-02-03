# MANDATORY REMEDIATION PLAN: RFC-049

**Issued By:** Symphony-Architect-Zero  
**Date:** 2025-12-29  
**Status:** CONDITIONAL APPROVAL → Remediation Required

---

## I. THE FIX LIST

| ID | Observation | Priority | Corrective Action |
|---|---|---|---|
| **REM-001** | Missing `src/new/index.ts` barrel export | **BLOCKER** | Create `src/new/index.ts` exporting all public classes |
| **REM-002** | File naming drift: `SynapticGrooveBuilder.ts` vs RFC `GrooveBuilder.ts` | **COMPLIANCE** | **RFC AMENDMENT** (see Section III) |
| **REM-003** | TODO comment in `pitch.ts:10` | **COMPLIANCE** | Remove or convert to JSDoc `@remarks` |
| **REM-004** | Regex allocation in `parsePitch()` | **OPTIMIZATION** | Implement zero-alloc char scanner (see Section II) |
| **REM-005** | Regex allocation in `parseChord()` | **OPTIMIZATION** | Implement zero-alloc char scanner (see Section II) |

---

## II. THE OPTIMIZATION DEMAND

### Current Violation

```typescript
// pitch.ts:19
const match = input.match(/^([A-G][#b]?)(-?\d+)$/);

// chord.ts:36
const match = symbol.match(ROOT_REGEX);
```

`.match()` allocates a new array per call. In a cold path (once per note), this is tolerable. However, **perfection demands zero allocations**.

### Zero-Alloc Alternative: Character Scanning State Machine

**Feasibility: YES.**

The pitch format `[A-G][#b]?[-]?\d+` is trivially parseable via index scanning:

```typescript
// Proposed zero-alloc parsePitch()
export function parsePitch(input: string | number): number {
  if (typeof input === 'number') return input;
  
  let i = 0;
  const len = input.length;
  
  // 1. Parse note letter [A-G]
  const noteChar = input.charCodeAt(i);
  if (noteChar < 65 || noteChar > 71) throw new Error('Invalid note');
  const noteBase = NOTE_OFFSETS[noteChar - 65]; // Pre-computed: A=9, B=11, C=0...
  i++;
  
  // 2. Parse optional accidental [#b]
  let accidental = 0;
  if (i < len) {
    const acc = input.charCodeAt(i);
    if (acc === 35) { accidental = 1; i++; }      // '#'
    else if (acc === 98) { accidental = -1; i++; } // 'b'
  }
  
  // 3. Parse octave (negative allowed)
  let negative = false;
  if (i < len && input.charCodeAt(i) === 45) { negative = true; i++; }
  
  let octave = 0;
  while (i < len) {
    const d = input.charCodeAt(i) - 48;
    if (d < 0 || d > 9) throw new Error('Invalid octave');
    octave = octave * 10 + d;
    i++;
  }
  if (negative) octave = -octave;
  
  return (octave + 1) * 12 + noteBase + accidental;
}
```

**Chord parsing** follows the same pattern: scan for root note, then lookup suffix in `CHORD_MAP`.

### Mandate

| Task ID | Action | Priority |
|---|---|---|
| **REM-004** | Rewrite `parsePitch()` as zero-alloc char scanner | **OPTIMIZATION** |
| **REM-005** | Rewrite `parseChord()` root extraction as zero-alloc char scanner | **OPTIMIZATION** |

> [!IMPORTANT]
> If the Engineer argues "cold path justification," I accept it ONLY with explicit inline comment:
> `// COLD PATH: Regex allocation acceptable per Architect ruling 049-25`

---

## III. STRICT RFC ALIGNMENT

### The Drift

| RFC Specification | Implementation |
|---|---|
| `groove/GrooveBuilder.ts` | `groove/SynapticGrooveBuilder.ts` |

### The Decision: **RFC AMENDMENT**

**Rationale:** The `Synaptic*` prefix is consistent with the entire package naming convention (`SynapticClip`, `SynapticMelody`, `SynapticCursor`). The RFC omitted the prefix in error. The implementation is correct; the RFC is wrong.

### Mandate

| Task ID | Action | Priority |
|---|---|---|
| **REM-006** | Amend RFC-049 Section 5.1 to specify `SynapticGrooveBuilder.ts` | **COMPLIANCE** |

---

## IV. REMEDIATION EXECUTION ORDER

```
1. [BLOCKER]      REM-001: Create index.ts
2. [COMPLIANCE]   REM-006: Amend RFC-049 naming
3. [COMPLIANCE]   REM-003: Remove TODO comment
4. [OPTIMIZATION] REM-004: Zero-alloc parsePitch (or document cold-path ruling)
5. [OPTIMIZATION] REM-005: Zero-alloc parseChord (or document cold-path ruling)
```

---

## V. ACCEPTANCE CRITERIA

The Engineer must deliver:

1. **`src/new/index.ts`** with exports:
   ```typescript
   // Cursors
   export { SynapticCursor } from './cursors/SynapticCursor';
   export { SynapticNoteCursor } from './cursors/SynapticNoteCursor';
   export { SynapticMelodyBaseCursor } from './cursors/SynapticMelodyBaseCursor';
   export { SynapticMelodyNoteCursor } from './cursors/SynapticMelodyNoteCursor';
   export { SynapticChordCursor } from './cursors/SynapticChordCursor';
   export { SynapticDrumHitCursor } from './cursors/SynapticDrumHitCursor';
   
   // Clips
   export { SynapticClip } from './clips/SynapticClip';
   export { SynapticMelody } from './clips/SynapticMelody';
   export { SynapticDrums } from './clips/SynapticDrums';
   
   // Groove
   export { SynapticGrooveBuilder, GrooveTemplate } from './groove/SynapticGrooveBuilder';
   export { GrooveStepCursor } from './groove/GrooveStepCursor';
   
   // Utils
   export { parsePitch } from './utils/pitch';
   export { parseChord, packIntervals } from './utils/chord';
   ```

2. **RFC-049 Amendment** at Section 5.1:
   - Change `groove/GrooveBuilder.ts` → `groove/SynapticGrooveBuilder.ts`

3. **`pitch.ts`** with TODO removed or replaced with JSDoc.

4. **EITHER:**
   - Zero-alloc parsers implemented, **OR**
   - Cold-path justification comments added per ruling.

---

**Upon completion, submit remediation log for final audit.**
