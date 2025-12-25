import { getModulatedTime } from '../scheduler'

describe('getModulatedTime', () => {
    test('passes through time when cycle is Infinity', () => {
        expect(getModulatedTime(100, Infinity)).toBe(100)
    })

    test('passes through time when cycle is 0', () => {
        expect(getModulatedTime(100, 0)).toBe(100)
    })

    test('modulates time when cycle is finite', () => {
        expect(getModulatedTime(100, 16)).toBe(4) // 100 % 16 = 4
        expect(getModulatedTime(16, 16)).toBe(0)
    })
})
