import fs from 'node:fs'
import path from 'node:path'
import glob from 'fast-glob'
import { isolatedDeclaration } from 'oxc-transform'
import { rolldown } from 'rolldown'
import picocolors from 'picocolors'

if (fs.existsSync('temp/packages')) {
  fs.rmSync('temp/packages', { recursive: true })
}

let errs = ''
let start = performance.now()
let count = 0

for (const file of await glob('packages/*/src/**/*.ts')) {
  if (file.includes('runtime-test')) continue

  const ts = fs.readFileSync(file, 'utf-8')
  const dts = isolatedDeclaration(file, ts, {
    sourcemap: false,
    stripInternal: true,
  })
  if (dts.errors.length) {
    dts.errors.forEach(err => {
      console.error(err)
      errs += err + '\n'
    })
  }

  write(path.join('temp', file.replace(/\.ts$/, '.d.ts')), dts.code)
  count++
}

console.log(
  `\n${count} isolated dts files generated in ${(performance.now() - start).toFixed(2)}ms.`,
)

if (errs) {
  write(path.join('temp', 'oxc-iso-decl-errors.txt'), errs)
}

console.log('bundling dts with rolldown-plugin-dts...')

// bundle with rolldown-plugin-dts
const rolldownConfigs = (await import('../rolldown.dts.config.js')).default

start = performance.now()

await Promise.all(
  rolldownConfigs.map(c =>
    rolldown(c).then(bundle => {
      return bundle.write(c.output).then(() => {
        console.log(picocolors.gray('built: ') + picocolors.blue(c.output.file))
      })
    }),
  ),
)

console.log(
  `bundled dts generated in ${(performance.now() - start).toFixed(2)}ms.`,
)

function write(file, content) {
  const dir = path.dirname(file)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(file, content)
}
