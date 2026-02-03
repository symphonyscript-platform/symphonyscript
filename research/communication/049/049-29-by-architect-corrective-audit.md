# CORRECTIVE AUDIT: RFC-049 API STYLE VIOLATIONS

**Auditor:** Symphony-Architect-Zero  
**Date:** 2025-12-29  
**Supersedes:** `049-28-by-architect-final-approval.md` (WITHDRAWN)

---

## I. ACKNOWLEDGMENT OF FAILURE

My previous approval was **PREMATURE**. The Human identified critical API style violations that I failed to catch. This is unacceptable.

---

## II. VIOLATION INVENTORY

### A. Procedural Setters (RFC NON-COMPLIANT)

**File:** `packages/composer/src/new/clips/SynapticClip.ts`

| Line | Violation | RFC Expectation |
|---|---|---|
| 81-83 | `setTranspose(semitones: number): void` | Should be fluent: `transpose(...)` returning `this` |
| 85-87 | `setScale(scaleName: string): void` | Should be fluent: `scale(...)` returning `this` |
| 89-91 | `setArpeggio(pattern: string): void` | Should be fluent: `arpeggio(...)` returning `this` |
| 93-96 | `setVibrato(rate, depth): void` | Should be fluent: `vibrato(...)` returning `this` |

**RFC-049 Section 4.4 States:**
> **Escapes**: `transpose()`, `scale()`, `arpeggio()`, `vibrato()`, etc.

The RFC uses **fluent naming** (`transpose()` not `setTranspose()`). These are **Escape methods** that should return `SynapticClip` per the Pending-State Pattern.

---

### B. Redundant Getters (UNNECESSARY)

**File:** `packages/composer/src/new/clips/SynapticClip.ts`

| Line | Violation | Analysis |
|---|---|---|
| 99-101 | `getTranspose(): number` | No public consumer. Internal state only. |
| 103-105 | `getScale(): string \| null` | No public consumer. Internal state only. |

These getters serve no documented purpose. The RFC specifies no getter API for clip state.

---

### C. Architectural Inconsistency

**File:** `packages/composer/src/new/cursors/SynapticMelodyNoteCursor.ts`

The cursor escape methods correctly call clip methods, but the clip methods have wrong signatures:

```typescript
// Line 99-102: Cursor calls clip.setTranspose - WRONG
transpose(semitones: number): SynapticClip {
    this.commit();
    this.clip.setTranspose(semitones);  // ← Procedural helper, not fluent chain
    return this.clip;
}
```

**Should be:**
```typescript
transpose(semitones: number): SynapticClip {
    this.commit();
    return this.clip.transpose(semitones);  // ← Fluent delegation
}
```

But this requires `SynapticClip.transpose()` to exist and be fluent.

---

## III. REMEDIATION PLAN (MANDATORY)

### REM-007: Convert Procedural Setters to Fluent Escapes (BLOCKER)

**File:** `packages/composer/src/new/clips/SynapticClip.ts`

**Action:** Replace procedural setters with fluent escape methods:

| Before | After |
|---|---|
| `setTranspose(s: number): void` | `transpose(s: number): this` |
| `setScale(n: string): void` | `scale(n: string): this` |
| `setArpeggio(p: string): void` | `arpeggio(p: string): this` |
| `setVibrato(r, d): void` | `vibrato(r, d): this` |

**Implementation:**
```typescript
transpose(semitones: number): this {
    this.transposeOffset = semitones;
    return this;
}

scale(scaleName: string): this {
    this.currentScale = scaleName;
    return this;
}

arpeggio(pattern: string): this {
    this.arpeggioPattern = pattern;
    return this;
}

vibrato(rate: number, depth: number): this {
    this.vibratoRate = rate;
    this.vibratoDepth = depth;
    return this;
}
```

---

### REM-008: Remove Redundant Getters (BLOCKER)

**File:** `packages/composer/src/new/clips/SynapticClip.ts`

**Action:** Delete lines 98-105:
```typescript
// DELETE: getTranspose(): number
// DELETE: getScale(): string | null
```

---

### REM-009: Simplify Cursor Escape Delegation (COMPLIANCE)

**File:** `packages/composer/src/new/cursors/SynapticMelodyNoteCursor.ts`

**Before:**
```typescript
transpose(semitones: number): SynapticClip {
    this.commit();
    this.clip.setTranspose(semitones);
    return this.clip;
}
```

**After:**
```typescript
transpose(semitones: number): SynapticClip {
    this.commit();
    return this.clip.transpose(semitones);
}
```

Apply to: `transpose()`, `scale()`, `arpeggio()`, `vibrato()`

---

## IV. EXECUTION ORDER

```
1. [BLOCKER]    REM-007: Convert SynapticClip procedural setters to fluent
2. [BLOCKER]    REM-008: Delete redundant getters from SynapticClip
3. [COMPLIANCE] REM-009: Simplify cursor escape delegation
4. [VERIFY]     Run test suite to confirm no regressions
```

---

## V. DISPOSITION

**STATUS:** PREVIOUS APPROVAL REVOKED

The Engineer must address REM-007, REM-008, and REM-009 before re-submission.

**Architect Signature:** Symphony-Architect-Zero  
**Issued:** 2025-12-29T13:14:00+04:00
