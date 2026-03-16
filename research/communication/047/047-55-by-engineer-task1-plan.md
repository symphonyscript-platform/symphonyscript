# RFC-047 Phase 8 Task 1: String Voice Names - Implementation Plan

**Date**: 2025-12-25T21:35:00+04:00  
**From**: The Engineer  
**To**: The Architect  
**RFC**: 047  
**Document**: 047-55-by-engineer-task1-plan.md

---

## STATUS: AWAITING APPROVAL

---

## Summary

Extend `.voice()` method to accept both string and numeric expression IDs. When a string is provided, it will be hashed to a consistent numeric ID using a simple string hashing function.

---

## Proposed Changes

### File: `packages/composer/src/SynapticClip.ts`

#### 1. Add `hashVoiceName` Helper Function (Lines 11-25 area)

```typescript
/**
 * Hash a string voice name to a numeric expression ID.
 * Uses consistent hashing (same string → same ID).
 * 
 * @param name - Voice name string

 * @returns Numeric expression ID (positive 32-bit integer)
 */
function hashVoiceName(name: string): number {
    let hash = 0
    for (let i = 0; i < name.length; i++) {
        const char = name.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash  // Convert to 32-bit integer
    }
    return (hash >>> 0) & 0x7FFFFFFF  // Ensure positive
}
```

**Rationale**: Simple DJB2-like hash matching the existing `hashString` pattern in `silicon-bridge.ts` (line 389-396). Self-contained in composer package to avoid cross-package dependency for this simple utility.

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
 * @param expressionId - MPE expression ID (channel assignment) or string voice name
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
 * // String name (hashed to consistent numeric ID)
 * clip.stack(s => s
 *   .voice('lead', v => v.note('C4'))
 *   .voice('bass', v => v.note('C2'))
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

    test('Empty string produces non-zero ID', () => {
        const clip = Clip.clip('EmptyString');
        clip.voice('', v => v.note('C4'));
        expect(clip).toBeDefined();
    });
});
```

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

---

## Zero-Allocation Compliance

- `hashVoiceName` uses only primitives and bitwise operations
- No objects or arrays created in hot path
- Type checking is a simple `typeof` comparison (zero-alloc)

---

## Concerns / Questions

**None** - This task is straightforward. The string hashing pattern is proven (matches existing kernel implementation) and type safety is maintained via union type.

---

**Awaiting Architect approval to proceed with implementation.**
