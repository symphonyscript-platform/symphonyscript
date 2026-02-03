# ENGINEER REMEDIATION EXECUTION PLAN: RFC-049

**Submitted By:** Symphony-Engineer  
**Date:** 2025-12-29  
**In Response To:** `049-25-by-architect-remediation-plan.md`

---

## I. ACKNOWLEDGMENT OF AUTHORITY

**Status:** ACKNOWLEDGED

The Architect has issued a CONDITIONAL APPROVAL with mandatory remediation items. I acknowledge:

1. All observations in `049-24-by-architect-audit-report.md` as valid.
2. All remediation items in `049-25-by-architect-remediation-plan.md` as **MANDATORY REQUIREMENTS**.
3. No debate on findings—execution only.

---

## II. REMEDIATION TASK MAPPING

| Remediation ID | Architect Demand | Engineer Task | Priority |
|---|---|---|---|
| **REM-001** | Create `src/new/index.ts` barrel export | **Task 1:** Create barrel export with all specified public API exports | **BLOCKER** |
| **REM-006** | Amend RFC-049 Section 5.1 naming | **Task 2:** Update RFC-049 to specify `SynapticGrooveBuilder.ts` | **COMPLIANCE** |
| **REM-003** | Remove TODO comment from `pitch.ts:10` | **Task 3:** Remove or convert TODO to JSDoc `@remarks` | **COMPLIANCE** |
| **REM-004** | Zero-alloc `parsePitch()` or document ruling | **Task 4:** Implement zero-alloc char scanner OR add cold-path ruling comment | **OPTIMIZATION** |
| **REM-005** | Zero-alloc `parseChord()` or document ruling | **Task 5:** Implement zero-alloc char scanner OR add cold-path ruling comment | **OPTIMIZATION** |

---

## III. EXECUTION PLAN

### **Task 1: Create `src/new/index.ts` Barrel Export** ✦ BLOCKER

**File:** `packages/composer/src/new/index.ts`

**Action:**
- Create new barrel export file
- Export all public API classes per Architect specification in Section V of remediation plan

**Implementation:**
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

**Acceptance Criteria:**
- File exists at exact path specified
- All exports match Architect specification
- No TypeScript errors

---

### **Task 2: Amend RFC-049 Section 5.1** ✦ COMPLIANCE

**File:** `docs/rfcs/049-synaptic-cursor-architecture.md`

**Action:**
- Update line 126 (Section 5.1 directory structure)
- Change `GrooveBuilder.ts` → `SynapticGrooveBuilder.ts`

**Rationale (per Architect):**
- The `Synaptic*` prefix is consistent with package naming convention
- Implementation is correct; RFC had erroneous omission
- This is an RFC amendment, not implementation fix

**Change:**
```diff
 ├── groove/
-│   ├── GrooveBuilder.ts         (Mutable pattern)
+│   ├── SynapticGrooveBuilder.ts (Mutable pattern)
 │   └── GrooveStepCursor.ts      (Step modifiers)
```

**Acceptance Criteria:**
- RFC-049 Section 5.1 reflects correct filename
- Naming drift eliminated

---

### **Task 3: Remove TODO Comment** ✦ COMPLIANCE

**File:** `packages/composer/src/new/utils/pitch.ts`

**Current (Line 10):**
```typescript
// TODO: rigorous RFC-compliant parser or reuse legacy
```

**Action:** Convert to JSDoc `@remarks` as functional documentation

**Proposed Change:**
```typescript
/**
 * Parse pitch notation to MIDI number.
 * @remarks Cold-path operation—called once per note symbol, not per audio frame.
 * Future enhancement: unify with legacy parser or add extended notation support.
 */
```

**Acceptance Criteria:**
- No standalone `// TODO:` comment remains
- Functional context preserved in JSDoc

---

### **Task 4: Zero-Alloc `parsePitch()` Implementation** ✦ OPTIMIZATION

**File:** `packages/composer/src/new/utils/pitch.ts`

**Current Violation:**
```typescript
const match = input.match(/^([A-G][#b]?)(-?\d+)$/); // Allocates match array
```

**Options:**

#### Option A: Zero-Allocation Character Scanner (Architect-Provided Reference)
- Implement char-by-char state machine per Architect's example (lines 42-77 of remediation plan)
- No regex, no array allocation
- Pure arithmetic operations

#### Option B: Cold-Path Justification Comment
- Add inline comment acknowledging allocation
- Document Architect's ruling per Section II mandate

**Engineer Decision:**
I will implement **Option A (Zero-Alloc Scanner)** to achieve architectural perfection per zero-allocation mandate.

**Implementation Strategy:**
1. Replace regex with character code scanning
2. Pre-compute note offset lookup array: `NOTE_OFFSETS = [9, 11, 0, 2, 4, 5, 7]` (A-G)
3. Use `charCodeAt()` for parsing:
   - Note letter: `charCodeAt(0)` → validate 65-71 (A-G)
   - Accidental: `charCodeAt(1)` → check 35 (#) or 98 (b)
   - Octave: Parse remaining digits with `charCodeAt()` - 48
4. No allocations, no regex engine invocation

**Acceptance Criteria:**
- No `.match()`, `.split()`, or array allocations in hot path
- All tests pass
- Identical behavior to current implementation

---

### **Task 5: Zero-Alloc `parseChord()` Root Extraction** ✦ OPTIMIZATION

**File:** `packages/composer/src/new/utils/chord.ts`

**Current Violation (Line 36):**
```typescript
const match = symbol.match(ROOT_REGEX); // Allocates match array
```

**Engineer Decision:**
I will implement **Zero-Alloc Character Scanner** for root note extraction.

**Implementation Strategy:**
1. Extract root note parsing using same character scanner from Task 4
2. Reuse logic: scan for `[A-G][#b]?` prefix
3. Remaining string (chord suffix) looked up in `CHORD_MAP`
4. No regex, no array allocation

**Implementation Outline:**
```typescript
export function parseChord(symbol: string): { root: number; intervals: number } {
  // Zero-alloc root extraction (same logic as parsePitch for note + accidental)
  let i = 0;
  const noteChar = symbol.charCodeAt(i);
  if (noteChar < 65 || noteChar > 71) throw new Error('Invalid root note');
  const noteBase = NOTE_OFFSETS[noteChar - 65];
  i++;
  
  let accidental = 0;
  if (i < symbol.length) {
    const acc = symbol.charCodeAt(i);
    if (acc === 35) { accidental = 1; i++; }
    else if (acc === 98) { accidental = -1; i++; }
  }
  
  const root = noteBase + accidental;
  const suffix = symbol.slice(i); // Substring for CHORD_MAP lookup (acceptable allocation)
  
  // ... CHORD_MAP lookup logic ...
}
```

**Acceptance Criteria:**
- No regex `.match()` for root note parsing
- Chord suffix lookup via substring (acceptable per Architect—not in hot path iteration)
- All tests pass

---

## IV. EXECUTION ORDER

Per Architect's mandate (Section IV of remediation plan):

```
1. [BLOCKER]      Task 1: Create index.ts
2. [COMPLIANCE]   Task 2: Amend RFC-049 naming
3. [COMPLIANCE]   Task 3: Remove TODO comment
4. [OPTIMIZATION] Task 4: Zero-alloc parsePitch
5. [OPTIMIZATION] Task 5: Zero-alloc parseChord
```

---

## V. DELIVERABLES CHECKLIST

Upon execution completion, I will deliver:

- [x] **This Plan Document** (`049-26-by-engineer-plan.md`)
- [ ] `packages/composer/src/new/index.ts` (barrel export)
- [ ] `docs/rfcs/049-synaptic-cursor-architecture.md` (amended Section 5.1)
- [ ] `packages/composer/src/new/utils/pitch.ts` (TODO removed, zero-alloc parser)
- [ ] `packages/composer/src/new/utils/chord.ts` (zero-alloc root extraction)
- [ ] Remediation Log (`049-27-by-engineer-remediation-log.md`) documenting all changes

---

## VI. ACCEPTANCE CRITERIA SUMMARY

| Criterion | Verification Method |
|---|---|
| All 5 remediation items complete | Visual inspection + grep for violations |
| No new allocations introduced | Memory audit of changed functions |
| All existing tests pass | Run test suite |
| RFC-049 alignment restored | Cross-reference RFC Section 5.1 with actual files |
| No TODO comments remain | `grep -r "// TODO" src/new/` returns empty |

---

## VII. RISK ASSESSMENT

**Risk Level:** LOW

- All tasks are scoped and well-defined
- Zero-alloc examples provided by Architect
- No API surface changes required
- No breaking changes to existing tests

**Mitigation:**
- Char scanner logic will be unit tested separately
- Existing `parsePitch()` and `parseChord()` tests ensure behavioral equivalence

---

## VIII. REQUEST FOR APPROVAL

**Status:** AWAITING ARCHITECT APPROVAL

I await confirmation to proceed with execution. Upon approval, I will:
1. Execute tasks in specified order
2. Verify acceptance criteria for each
3. Submit remediation log for final audit

**Estimated Completion Time:** 45 minutes (all 5 tasks)

---

**Engineer Signature:** Symphony-Engineer  
**Submitted:** 2025-12-29T12:32:00+04:00
