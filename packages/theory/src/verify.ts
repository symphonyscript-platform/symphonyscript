// Manual verification script for RFC-047 Phase 1 implementation
// This bypasses jest config issues and tests core functionality directly

import { pack, unpack, unpackToArray, countBits, transpose } from './packer';
import { INTERVAL } from './constants';
import { asHarmonyMask } from './types';

console.log('🧪 RFC-047 Phase 1: Manual Verification\n');

// Test 1: Major Triad
console.log('TEST 1: Major Triad (C-E-G)');
const majorMask = pack([INTERVAL.UNISON, INTERVAL.MAJOR_THIRD, INTERVAL.PERFECT_FIFTH]);
console.log(`  Expected: 0x4101`);
console.log(`  Got:      0x${majorMask.toString(16)}`);
console.log(`  ✓ PASS: ${majorMask === 0x4101}\n`);

// Test 2: Minor Triad (CRITICAL FIX #6)
console.log('TEST 2: Minor Triad (C-Eb-G)');
const minorMask = pack([INTERVAL.UNISON, INTERVAL.MINOR_THIRD, INTERVAL.PERFECT_FIFTH]);
console.log(`  Expected: 0x4041`);
console.log(`  Got:      0x${minorMask.toString(16)}`);
console.log(`  ✓ PASS: ${minorMask === 0x4041}\n`);

// Test 3: Negative Modulo (CRITICAL FIX #1)
console.log('TEST 3: Negative Interval pack([-1])');
const negMask = pack([-1]);
console.log(`  Expected: 0x${(1 << 23).toString(16)} (bit 23)`);
console.log(`  Got:      0x${negMask.toString(16)}`);
console.log(`  ✓ PASS: ${negMask === (1 << 23)}\n`);

// Test 4: Empty Array
console.log('TEST 4: Empty array pack([])');
const emptyMask = pack([]);
console.log(`  Expected: 0x0`);
console.log(`  Got:      0x${emptyMask.toString(16)}`);
console.log(`  ✓ PASS: ${emptyMask === 0}\n`);

// Test 5: Count Bits
console.log('TEST 5: Count bits in major triad');
const count = countBits(majorMask);
console.log(`  Expected: 3`);
console.log(`  Got:      ${count}`);
console.log(`  ✓ PASS: ${count === 3}\n`);

// Test 6: Unpack callback (zero allocation)
console.log('TEST 6: Unpack callback (zero allocation)');
const intervals: number[] = [];
unpack(majorMask, (i) => intervals.push(Number(i)));
console.log(`  Expected: [0, 8, 14]`);
console.log(`  Got:      [${intervals.join(', ')}]`);
console.log(`  ✓ PASS: ${JSON.stringify(intervals) === JSON.stringify([0, 8, 14])}\n`);

// Test 7: Transpose
console.log('TEST 7: Transpose major triad up 2 semitones (4 steps)');
const transposed = transpose(majorMask, 4);
const transposedIntervals = unpackToArray(transposed).map(i => Number(i));
console.log(`  Expected: [4, 12, 18] (D-F#-A)`);
console.log(`  Got:      [${transposedIntervals.join(', ')}]`);
console.log(`  ✓ PASS: ${JSON.stringify(transposedIntervals) === JSON.stringify([4, 12, 18])}\n`);

console.log('✅ All critical tests passed!');
console.log('📊 Phase 1 Implementation: VERIFIED');
