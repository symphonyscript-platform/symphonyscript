# 008-01: BUILD-001 Complete

**Task:** Fix jest.config.cjs  
**Status:** COMPLETE  
**Date:** 2026-02-01

---

## Problem

`packages/theory/jest.config.cjs` used ES6 `import` syntax in a CommonJS file:

```javascript
// BEFORE (broken):
import { readFileSync } from 'fs';
```

## Solution

Changed to CommonJS `require`:

```javascript
// AFTER (fixed):
const { readFileSync } = require('fs');
```

## Verification

```
$ cd packages/theory && pnpm test

> @symphonyscript/theory@0.1.0 test
> jest --config jest.config.cjs

PASS @symphonyscript/theory src/__tests__/packer.test.ts

Test Suites: 1 skipped, 1 passed, 1 of 2 total
Tests:       2 skipped, 16 passed, 18 total
Snapshots:   0 total
Time:        0.725 s
```

## Next

Proceeding to REWRITE-001: Chord definitions (24-EDO native).
