// @ts-check
import path from 'node:path'
import { markdownTable } from 'markdown-table'
import prettyBytes from 'pretty-bytes'
import { readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'

const currDir = path.resolve('temp/size')
const prevDir = path.resolve('temp/size-prev')
let output = '## Size Report\n\n'

run()

async function run() {
  await renderFiles()
  await renderBaseline()
  await processExports()

  process.stdout.write(output)
}

async function renderFiles() {
  /**
   *
   * @param {string[]} files
   * @returns {string[]}
   */
  const filterFiles = files => files.filter(file => !file.startsWith('_'))

  const curr = filterFiles(await readdir(currDir))
  const prev = existsSync(prevDir) ? filterFiles(await readdir(prevDir)) : []
  const fileList = new Set([...curr, ...prev])

  /** @type string[][] */
  const rows = []
  for (const file of fileList) {
    const currPath = path.resolve(currDir, file)
    const prevPath = path.resolve(prevDir, file)

    const curr = await importJSON(currPath)
    const prev = await importJSON(prevPath)
    const fileName = curr?.file || prev?.file

    if (!curr) {
      rows.push([`~~${fileName}~~`])
    } else
      rows.push([
        fileName,
        `${prettyBytes(curr.size)}${getDiff(curr.size, prev?.size)}`,
        `${prettyBytes(curr.gzip)}${getDiff(curr.gzip, prev?.gzip)}`,
        `${prettyBytes(curr.brotli)}${getDiff(curr.brotli, prev?.brotli)}`
      ])
  }

  output += '### Bundles\n\n'
  output += markdownTable([['File', 'Size', 'Gzip', 'Brotli'], ...rows])
  output += '\n\n'
}

async function renderBaseline() {
  const curr = await importJSON(path.resolve(currDir, '_baseline.json'))
  const prev = await importJSON(path.resolve(prevDir, '_baseline.json'))
  output += `### Baseline\n\n`
  output += markdownTable([
    ['Size', 'Gzip', 'Brotli'],
    [
      `${prettyBytes(curr.size)}${getDiff(curr.size, prev?.size)}`,
      `${prettyBytes(curr.gzip)}${getDiff(curr.gzip, prev?.gzip)}`,
      `${prettyBytes(curr.brotli)}${getDiff(curr.brotli, prev?.brotli)}`
    ]
  ])
  output += '\n\n'
}

async function processExports() {
  const curr = await importJSON(path.resolve(currDir, '_exports.json'))
  const prev = await importJSON(path.resolve(prevDir, '_exports.json'))
  output += '\n### Exports\n\n<details>\n\n'
  if (prev) {
    output += renderExports(curr, prev)
  }
  output += `\n\n<details>\n<summary>Show full exports</summary>\n\n${renderExports(
    curr
  )}\n\n</details>\n</details>\n\n`
}

/** @typedef {Record<string, import('@sxzz/export-size').ExportsInfo>} ExportMap */

/**
 *
 * @param {ExportMap} exports
 * @param {ExportMap} [prev]
 * @returns
 */
function renderExports(exports, prev) {
  const data = Object.entries(exports)
    .map(
      /** @returns {any} */
      ([key, exp]) => {
        const prevExport = prev?.[key]
        const diffBundled = getDiff(exp.bundled, prevExport?.bundled)
        const diffMinified = getDiff(exp.minified, prevExport?.minified)
        const diffMinzipped = getDiff(exp.minzipped, prevExport?.minzipped)
        if (prev && !diffBundled && !diffMinified && !diffMinzipped) {
          return
        }

        return [
          `\`${exp.name}\``,
          `${prettyBytes(exp.bundled)}${diffBundled}`,
          `${prettyBytes(exp.minified)}${diffMinified}`,
          `${prettyBytes(exp.minzipped)}${diffMinzipped}`
        ]
      }
    )
    .filter(Boolean)
  if (data.length === 0) return 'No changes'
  return markdownTable([['Name', 'Size', 'Minified', 'Brotli'], ...data])
}

/**
 * @param {string} path
 */
async function importJSON(path) {
  if (!existsSync(path)) return undefined
  return (await import(path, { assert: { type: 'json' } })).default
}

/**
 *
 * @param {number} curr
 * @param {number} [prev]
 */
function getDiff(curr, prev) {
  if (prev === undefined) return ''
  const diff = curr - prev
  if (diff === 0) return ''
  const sign = diff > 0 ? '+' : ''
  return ` (**${sign}${prettyBytes(diff)}**)`
}
