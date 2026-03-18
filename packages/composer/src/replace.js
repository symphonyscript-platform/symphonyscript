#!/usr/bin/env node
/**
 * Replace string note notation with cents in composer test files.
 * Run from repo root: node scripts/replace-string-pitches-with-cents.js
 */

import * as fs from 'fs'
import * as path from 'path'

const __dirname = path.dirname(new URL(import.meta.url).pathname)
const ROOT = path.join(__dirname, '__tests__')

// Base cents per pitch class (within octave)
const BASE = { C: 0, 'C#': 100, Db: 100, D: 200, 'D#': 300, Eb: 300, E: 400, F: 500, 'F#': 600, Gb: 600, G: 700, 'G#': 800, Ab: 800, A: 900, 'A#': 1000, Bb: 1000, B: 1100 }

function noteToCents(name) {
    const m = String(name).match(/^([A-G][b#]?)(-?\d+)$/)
    if (!m) return null
    const base = BASE[m[1]]
    if (base === undefined) return null
    const oct = parseInt(m[2], 10)
    return (oct + 1) * 1200 + base
}

function replaceInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8')
    let changed = false

    // 1. Remove notations import
    if (content.includes("from '@symphonyscript/notations'")) {
        content = content.replace(/\nimport \{ PitchClass, ScaleMode \} from '@symphonyscript\/notations'\n/, '\n')
        content = content.replace(/\nimport \{ PitchClass \} from '@symphonyscript\/notations'\n/, '\n')
        changed = true
    }

    // 2. scaleRoot: PitchClass.C, scaleMode: ScaleMode.MAJOR → scaleRootCents: 6000
    content = content.replace(/scaleRoot:\s*PitchClass\.\w+,\s*\n\s*scaleMode:\s*ScaleMode\.\w+,\s*\n/g, 'scaleRootCents: 6000,\n')
    content = content.replace(/scaleRoot:\s*PitchClass\.\w+,\s*scaleMode:\s*ScaleMode\.\w+,/g, 'scaleRootCents: 6000,')
    if (content !== fs.readFileSync(filePath, 'utf8')) changed = true

    // 3. Replace quoted note names with cents (in common patterns)
    const notePattern = /'([A-G][b#]?-?\d+)'|"([A-G][b#]?-?\d+)"/g
    content = content.replace(notePattern, (match, g1, g2) => {
        const name = g1 || g2
        const cents = noteToCents(name)
        if (cents !== null) {
            changed = true
            return cents
        }
        return match
    })

    if (changed) {
        fs.writeFileSync(filePath, content)
        console.log('Updated:', path.relative(process.cwd(), filePath))
    }
}

function walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const e of entries) {
        const full = path.join(dir, e.name)
        if (e.isDirectory()) walkDir(full)
        else if (e.name.endsWith('.test.ts') || e.name.endsWith('.test.tsx') || (e.name.endsWith('.ts') && full.includes('__tests__'))) {
            replaceInFile(full)
        }
    }
}

walkDir(ROOT)
console.log('Done.')
