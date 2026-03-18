/**
 * Tests for util/ - Utility Classes
 */

import {
    MinHeap,
    createNumberHeap,
    createMaxHeap,
    SeededRandom,
    createRandom,
    hashString,
    combineSeed,
} from '../util';

describe('util/heap', () => {
    // =========================================================================
    // MinHeap
    // =========================================================================
    describe('MinHeap', () => {
        it('maintains min-heap property', () => {
            const heap = new MinHeap<number>((a, b) => a - b);
            heap.push(5);
            heap.push(3);
            heap.push(7);
            heap.push(1);

            expect(heap.pop()).toBe(1);
            expect(heap.pop()).toBe(3);
            expect(heap.pop()).toBe(5);
            expect(heap.pop()).toBe(7);
        });

        it('peek returns minimum without removing', () => {
            const heap = new MinHeap<number>((a, b) => a - b);
            heap.push(5);
            heap.push(3);

            expect(heap.peek()).toBe(3);
            expect(heap.size()).toBe(2);
            expect(heap.peek()).toBe(3);
        });

        it('isEmpty returns correct state', () => {
            const heap = new MinHeap<number>((a, b) => a - b);
            expect(heap.isEmpty()).toBe(true);

            heap.push(1);
            expect(heap.isEmpty()).toBe(false);

            heap.pop();
            expect(heap.isEmpty()).toBe(true);
        });

        it('size returns correct count', () => {
            const heap = new MinHeap<number>((a, b) => a - b);
            expect(heap.size()).toBe(0);

            heap.push(1);
            heap.push(2);
            heap.push(3);
            expect(heap.size()).toBe(3);

            heap.pop();
            expect(heap.size()).toBe(2);
        });

        it('pop returns undefined for empty heap', () => {
            const heap = new MinHeap<number>((a, b) => a - b);
            expect(heap.pop()).toBeUndefined();
        });

        it('peek returns undefined for empty heap', () => {
            const heap = new MinHeap<number>((a, b) => a - b);
            expect(heap.peek()).toBeUndefined();
        });

        it('works with custom comparator', () => {
            interface Item { priority: number; value: string }
            const heap = new MinHeap<Item>((a, b) => a.priority - b.priority);

            heap.push({ priority: 3, value: 'c' });
            heap.push({ priority: 1, value: 'a' });
            heap.push({ priority: 2, value: 'b' });

            expect(heap.pop()!.value).toBe('a');
            expect(heap.pop()!.value).toBe('b');
            expect(heap.pop()!.value).toBe('c');
        });

        it('clear removes all items', () => {
            const heap = new MinHeap<number>((a, b) => a - b);
            heap.push(1);
            heap.push(2);
            heap.push(3);

            heap.clear();
            expect(heap.isEmpty()).toBe(true);
            expect(heap.size()).toBe(0);
        });

        it('toArray returns copy of items', () => {
            const heap = new MinHeap<number>((a, b) => a - b);
            heap.push(3);
            heap.push(1);
            heap.push(2);

            const arr = heap.toArray();
            expect(arr).toHaveLength(3);
            expect(arr).toContain(1);
            expect(arr).toContain(2);
            expect(arr).toContain(3);
        });
    });

    // =========================================================================
    // createNumberHeap / createMaxHeap
    // =========================================================================
    describe('createNumberHeap()', () => {
        it('creates min-heap for numbers', () => {
            const heap = createNumberHeap();
            heap.push(5);
            heap.push(3);
            heap.push(7);

            expect(heap.pop()).toBe(3);
            expect(heap.pop()).toBe(5);
            expect(heap.pop()).toBe(7);
        });
    });

    describe('createMaxHeap()', () => {
        it('creates max-heap for numbers', () => {
            const heap = createMaxHeap();
            heap.push(5);
            heap.push(3);
            heap.push(7);

            expect(heap.pop()).toBe(7);
            expect(heap.pop()).toBe(5);
            expect(heap.pop()).toBe(3);
        });
    });
});

describe('util/random', () => {
    // =========================================================================
    // SeededRandom
    // =========================================================================
    describe('SeededRandom', () => {
        it('produces deterministic sequence', () => {
            const rng1 = new SeededRandom(12345);
            const rng2 = new SeededRandom(12345);

            for (let i = 0; i < 10; i++) {
                expect(rng1.next()).toBe(rng2.next());
            }
        });

        it('different seeds produce different sequences', () => {
            const rng1 = new SeededRandom(12345);
            const rng2 = new SeededRandom(54321);

            expect(rng1.next()).not.toBe(rng2.next());
        });

        it('next() returns values in [0, 1)', () => {
            const rng = new SeededRandom(12345);
            for (let i = 0; i < 100; i++) {
                const val = rng.next();
                expect(val).toBeGreaterThanOrEqual(0);
                expect(val).toBeLessThan(1);
            }
        });

        it('range() returns values in [min, max)', () => {
            const rng = new SeededRandom(12345);
            for (let i = 0; i < 100; i++) {
                const val = rng.range(10, 20);
                expect(val).toBeGreaterThanOrEqual(10);
                expect(val).toBeLessThan(20);
            }
        });

        it('int() returns integers in [min, max]', () => {
            const rng = new SeededRandom(12345);
            const counts = new Map<number, number>();

            for (let i = 0; i < 1000; i++) {
                const val = rng.int(1, 6);
                expect(Number.isInteger(val)).toBe(true);
                expect(val).toBeGreaterThanOrEqual(1);
                expect(val).toBeLessThanOrEqual(6);
                counts.set(val, (counts.get(val) || 0) + 1);
            }

            // All values 1-6 should appear
            for (let i = 1; i <= 6; i++) {
                expect(counts.get(i)).toBeGreaterThan(0);
            }
        });

        it('pick() returns random element', () => {
            const rng = new SeededRandom(12345);
            const arr = ['a', 'b', 'c', 'd'];

            for (let i = 0; i < 10; i++) {
                const val = rng.pick(arr);
                expect(arr).toContain(val);
            }
        });

        it('pick() returns undefined for empty array', () => {
            const rng = new SeededRandom(12345);
            expect(rng.pick([])).toBeUndefined();
        });

        it('shuffle() shuffles array in place', () => {
            const rng = new SeededRandom(12345);
            const arr = [1, 2, 3, 4, 5];
            const original = [...arr];

            const result = rng.shuffle(arr);

            expect(result).toBe(arr); // Same reference
            expect(arr).toHaveLength(5);
            expect(arr.sort()).toEqual(original.sort()); // Same elements
        });

        it('shuffled() returns new shuffled array', () => {
            const rng = new SeededRandom(12345);
            const arr = [1, 2, 3, 4, 5];
            const original = [...arr];

            const result = rng.shuffled(arr);

            expect(result).not.toBe(arr); // Different reference
            expect(arr).toEqual(original); // Original unchanged
            expect(result.sort()).toEqual(original.sort()); // Same elements
        });

        it('bool() returns boolean with probability', () => {
            const rng = new SeededRandom(12345);
            let trueCount = 0;

            for (let i = 0; i < 1000; i++) {
                if (rng.bool(0.7)) trueCount++;
            }

            // Should be roughly 70% true
            expect(trueCount).toBeGreaterThan(600);
            expect(trueCount).toBeLessThan(800);
        });

        it('weighted() returns values based on weights', () => {
            const rng = new SeededRandom(12345);
            const options: [string, number][] = [
                ['rare', 1],
                ['common', 9],
            ];

            let rareCount = 0;
            for (let i = 0; i < 1000; i++) {
                if (rng.weighted(options) === 'rare') rareCount++;
            }

            // Should be roughly 10% rare
            expect(rareCount).toBeGreaterThan(50);
            expect(rareCount).toBeLessThan(200);
        });

        it('weighted() returns undefined for empty options', () => {
            const rng = new SeededRandom(12345);
            expect(rng.weighted([])).toBeUndefined();
        });

        it('fork() creates independent generator', () => {
            const rng1 = new SeededRandom(12345);
            rng1.next(); // Advance state

            const forked = rng1.fork();

            // Forked should produce different sequence than continuing original
            const original1 = rng1.next();
            const forked1 = forked.next();
            expect(original1).not.toBe(forked1);
        });

        it('getState/setState allows serialization', () => {
            const rng = new SeededRandom(12345);
            rng.next();
            rng.next();

            const state = rng.getState();
            const val1 = rng.next();

            rng.setState(state);
            const val2 = rng.next();

            expect(val1).toBe(val2);
        });
    });

    // =========================================================================
    // createRandom()
    // =========================================================================
    describe('createRandom()', () => {
        it('creates SeededRandom with provided seed', () => {
            const rng1 = createRandom(12345);
            const rng2 = createRandom(12345);

            expect(rng1.next()).toBe(rng2.next());
        });

        it('creates SeededRandom with default seed', () => {
            const rng = createRandom();
            expect(rng).toBeInstanceOf(SeededRandom);
        });
    });

    // =========================================================================
    // hashString()
    // =========================================================================
    describe('hashString()', () => {
        it('produces consistent hash for same string', () => {
            expect(hashString('hello')).toBe(hashString('hello'));
            expect(hashString('world')).toBe(hashString('world'));
        });

        it('produces different hash for different strings', () => {
            expect(hashString('hello')).not.toBe(hashString('world'));
        });

        it('returns unsigned 32-bit integer', () => {
            const hash = hashString('test');
            expect(hash).toBeGreaterThanOrEqual(0);
            expect(hash).toBeLessThanOrEqual(0xFFFFFFFF);
        });

        it('handles empty string', () => {
            expect(hashString('')).toBe(0);
        });
    });

    // =========================================================================
    // combineSeed()
    // =========================================================================
    describe('combineSeed()', () => {
        it('combines multiple values into seed', () => {
            const seed = combineSeed('hello', 123, 'world');
            expect(typeof seed).toBe('number');
            expect(seed).toBeGreaterThanOrEqual(0);
        });

        it('produces consistent results', () => {
            expect(combineSeed('a', 1)).toBe(combineSeed('a', 1));
        });

        it('produces different results for different inputs', () => {
            expect(combineSeed('a', 1)).not.toBe(combineSeed('b', 1));
            expect(combineSeed('a', 1)).not.toBe(combineSeed('a', 2));
        });

        it('handles empty input', () => {
            expect(combineSeed()).toBe(0);
        });
    });
});
