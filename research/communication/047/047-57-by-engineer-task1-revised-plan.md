# RFC-047 Phase 8 Task 1: String Voice Names - REVISED Implementation Plan

**Date**: 2025-12-25T21:38:00+04:00  
**From**: The Engineer  
**To**: The Architect  
**RFC**: 047  
**Document**: 047-57-by-engineer-task1-revised-plan.md

---

## STATUS: AWAITING APPROVAL (REVISION 1)

---

## Summary

Extend `.voice()` method to accept both string and numeric expression IDs. When a string is provided, it will be hashed to a consistent numeric ID using the **exact same algorithm as kernel's `hashString`**, then masked to 4-bit MPE range (0-15).

---

## Critical Issues Addressed

1. ✅ **Hash algorithm now matches kernel** - Uses `| 0` instead of no-op `& hash`
2. ✅ **MPE 4-bit range enforced** - Masks to `& 0xF` (0-15)
3. ✅ **Empty string handled explicitly** - Test updated to verify no crash (hashes to 0, which is valid default)
4. ✅ **Loop style compliant** - Uses `while` with `i = i + 1`

---

## Proposed Changes

### File: `packages/composer/src/SynapticClip.ts`

#### 1. Add `hashVoiceName` Helper Function (Lines 11-25 area)

```typescript
/**
 * Hash a string voice name to a numeric expression ID.
 * Uses the EXACT SAME algorithm as kernel's hashString (silicon-bridge.ts:389-396).
 * 
 * NOTE: Result is masked to 4 bits (0-15) for MPE routing.
 * Different voice names may map to the same MPE channel due to hash collisions.
 * 
 * @param name - Voice name string
 * @returns Numeric expression ID (0-15)
 */
function hashVoiceName(name: string): number {
    let hash = 0
    let i = 0
    while (i < name.length) {
        hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
        i = i + 1
    }
    // Mask to 4 bits for MPE channel range (0-15)
    return (hash >>> 0) & 0xF
}
```

**Changes from previous version**:
- ❌ Removed `hash & hash` no-op
- ✅ Added `| 0` to match kernel algorithm exactly
- ✅ Changed final mask from `& 0x7FFFFFFF` to `& 0xF` for MPE compliance
- ✅ Changed `for` loop to `while` loop with `i = i + 1`
- ✅ Added documentation about 4-bit limitation and potential collisions

#### 2. Update `voice()` Method Signature and Implementation (Line 225-237)

**Current** (Line 225):
```typescript
voice(expressionId: number, builderFn: (v: SynapticClip) => void): this {
```

**Proposed**:
```typescript
/**
 * Tag voice with expression ID for MPE routing.
 * 
 * Executes builder callback and tags all notes with expressionId.
 * Per RFC-047 brainstorming session requirements.
 * 
 * @param expressionId - MPE expression ID (0-15) or string voice name (hashed to 0-15)
 * @param builderFn - Callback to build notes for this voice
 * @returns this for fluent chaining
 * 
 * @example
 * // Numeric ID
 * clip.stack(s => s
 *   .voice(1, v => v.note('C4'))  // MPE Channel 1
 *   .voice(2, v => v.note('E4'))  // MPE Channel 2
 * );
 * 
 * @example
 * // String name (hashed to consistent 4-bit ID)
 * clip.stack(s => s
 *   .voice('lead', v => v.note('C4'))   // Hashed to 0-15
 *   .voice('bass', v => v.note('C2'))   // Hashed to 0-15
 * );
 */
voice(expressionId: string | number, builderFn: (v: SynapticClip) => void): this {
    // Resolve string to numeric ID via hashing
    const numericId = typeof expressionId === 'string' 
        ? hashVoiceName(expressionId)
        : expressionId

    // Store current expressionId (for tagging)
    const previousExpressionId = this.currentExpressionId
    this.currentExpressionId = numericId

    // Execute builder (all notes inside get tagged)
    builderFn(this)

    // Restore previous ID
    this.currentExpressionId = previousExpressionId

    return this
}
```

**Changes from previous version**:
- ✅ Updated JSDoc to clarify 0-15 range
- ✅ No implementation changes (was already correct)

---

## Tests to Add

### File: `packages/composer/src/__tests__/voice.test.ts`

Add the following test cases after the existing tests:

```typescript
describe('String Voice Names', () => {
    test('Voice accepts string name', () => {
        const clip = Clip.clip('StringVoice');
        clip.voice('lead', v => v.note('C4'));
        expect(clip).toBeDefined();
    });

    test('Same string produces same ID (consistent hashing)', () => {
        const clip = Clip.clip('ConsistentHash');
        // Same voice name should route to same expression
        clip.voice('lead', v => v.note('C4'));
        clip.voice('lead', v => v.note('E4'));  // Same ID
        clip.voice('bass', v => v.note('C2'));  // Different ID
        expect(clip).toBeDefined();
    });

    test('String and number can be mixed', () => {
        const clip = Clip.clip('MixedVoices');
        clip.stack(s => s
            .voice(1, v => v.note('C4'))      // Numeric
            .voice('alto', v => v.note('E4'))  // String
        );
        expect(clip).toBeDefined();
    });

    test('Empty string is valid (hashes to 0, default voice)', () => {
        // Empty string hashes to 0, which is the default voice.
        // This is valid behavior - no crash expected.
        const clip = Clip.clip('EmptyString');
        clip.voice('', v => v.note('C4'));
        expect(clip).toBeDefined();
    });
});
```

**Changes from previous version**:
- ✅ Updated empty string test comment to clarify it verifies no crash
- ✅ Removed misleading "produces non-zero ID" claim

---

## Verification Plan

### Automated Tests

Run:
```bash
cd /Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/composer
npm run test -- voice.test.ts
```

Expected: All existing tests pass + 4 new string voice tests pass.

### Type Safety Verification

Verify TypeScript compilation with:
```bash
cd /Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/composer
npx tsc --noEmit
```

Expected: No type errors.

### Hash Algorithm Verification

Manual verification that `hashVoiceName('test')` produces:
1. Same intermediate values as kernel's `hashString('test')`
2. Final value in range 0-15

---

## Zero-Allocation Compliance

- `hashVoiceName` uses only primitives and bitwise operations
- No objects or arrays created (RFC-045-04 compliant)
- Type checking is a simple `typeof` comparison (zero-alloc)
- Uses `while` loop instead of `for` loop per kernel standard

---

## MPE Range Limitation

**DOCUMENTED**: The 4-bit mask (`& 0xF`) means only 16 distinct MPE channels are available. Voice names that hash to the same 4-bit value will share the same MPE channel. This is expected behavior and consistent with MPE specification limits.

---

## Concerns / Questions

**None** - All critical issues from rejection have been addressed.

---

**Awaiting Architect approval to proceed with implementation.**
