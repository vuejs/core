import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { compileScript, parse } from '../../src'
import { registerTS } from '../../src/script/resolveType'

// Simulates what `require('typescript')` returns in TypeScript 7:
// the main entry only exposes the version, the legacy synchronous
// compiler API (`ts.sys`, `ts.resolveModuleName`, `ts.findConfigFile`, ...)
// is gone.
// https://github.com/vuejs/core/issues/15997
const ts7Like = {
  version: '7.1.0-beta',
  versionMajorMinor: '7.1',
} as any

registerTS(() => ts7Like)

function compileSFC(entry: string, files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'vue-sfc-ts7-'))
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content)
  }
  const filename = join(dir, entry)
  const { descriptor } = parse(files[entry]!, { filename })
  return compileScript(descriptor, { id: 'ts7-test' }).content
}

describe('resolveType with TypeScript 7 (no ts.sys)', () => {
  test('relative type imports resolve via node:fs fallback', () => {
    const content = compileSFC('Comp.vue', {
      'types.ts': `export interface Props {\n  msg: string\n}\n`,
      'Comp.vue': `<script setup lang="ts">\nimport type { Props } from "./types"\ndefineProps<Props>()\n</script>\n`,
    })
    expect(content).toMatch(/msg:\s*\{\s*type:\s*String,\s*required:\s*true\s*\}/)
  })

  test('non-relative type imports report a proper error instead of TypeError', () => {
    expect(() =>
      compileSFC('Comp.vue', {
        'Comp.vue': `<script setup lang="ts">\nimport type { Props } from "some-unresolvable-pkg"\ndefineProps<Props>()\n</script>\n`,
      }),
    ).toThrow(/Failed to resolve import source/)
  })
})
