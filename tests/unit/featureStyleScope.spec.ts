import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Style-isolation regression guard: every feature .vue file must declare its
// style block as `scoped` so page CSS cannot leak across features (e.g. Gym
// rules hitting HomePage). Plain (unscoped) blocks are a failure unless the
// file is explicitly allow-listed below.

const FEATURES_DIR = join(__dirname, '..', '..', 'src', 'features')

function walkVueFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...walkVueFiles(full))
    } else if (entry.endsWith('.vue')) {
      out.push(full)
    }
  }
  return out
}

describe('feature style scope', () => {
  it('every feature .vue file uses <style scoped>', () => {
    const offenders = walkVueFiles(FEATURES_DIR).filter((file) => {
      const src = readFileSync(file, 'utf8')
      return /<style(?![^>]*\bscoped\b)[^>]*>/.test(src)
    })
    const relative = offenders.map((f) => f.slice(FEATURES_DIR.length + 1))
    expect(relative).toEqual([])
  })
})
