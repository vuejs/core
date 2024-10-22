// @ts-check
import path from 'node:path'
import { markdownTable } from 'markdown-table'
import prettyBytes from 'pretty-bytes'
import { readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'

/**
 * @typedef {Object} SizeResult
 * @property {number} size
 * @property {number} gzip
 * @property {number} brotli
 */

/**
 * @typedef {SizeResult & { file: string }} BundleResult
 */

/**
 * @typedef {Record<string, SizeResult & { name: string }>} UsageResult
 */

const currDir = path.resolve('temp/size')
const prevDir = path.resolve('temp/size-prev')
let output = '## Size Report\n\n'
const sizeHeaders = ['Size', 'Gzip', 'Brotli']

run()

/**
 * Runs the main process of rendering file and usage data
 */
async function run() {
  await renderFiles()
  await renderUsages()

  process.stdout.write(output)
}

/**
 * Renders file sizes and diffs between current and previous versions
 */
async function renderFiles() {
  const filterFiles = files =>
    files.filter(file => file[0] !== '_' && !file.endsWith('.txt'))

  const curr = filterFiles(await readdir(currDir))
  const prev = existsSync(prevDir) ? filterFiles(await readdir(prevDir)) : []
  const fileList = new Set([...curr, ...prev])

  const rows = []
  for (const file of fileList) {
    const currPath = path.resolve(currDir, file)
    const prevPath = path.resolve(prevDir, file)

    const curr = await importJSON(currPath)
    const prev = await importJSON(prevPath)
    const fileName = curr?.file || prev?.file || ''

    if (!curr) {
      rows.push([`~~${fileName}~~`])
    } else {
      rows.push([
        fileName,
        `${prettyBytes(curr.size)}${getDiff(curr.size, prev?.size)}`,
        `${prettyBytes(curr.gzip)}${getDiff(curr.gzip, prev?.gzip)}`,
        `${prettyBytes(curr.brotli)}${getDiff(curr.brotli, prev?.brotli)}`,
      ])
    }
  }

  output += '### Bundles\n\n'
  output += markdownTable([['File', ...sizeHeaders], ...rows])
  output += '\n\n'
}

/**
 * Renders usage data comparing current and previous usage results
 */
async function renderUsages() {
  const curr = await importJSON(path.resolve(currDir, '_usages.json'))
  const prev = await importJSON(path.resolve(prevDir, '_usages.json'))

  output += '\n### Usages\n\n'

  const data = Object.values(curr)
    .map(usage => {
      const prevUsage = prev?.[usage.name]
      const diffSize = getDiff(usage.size, prevUsage?.size)
      const diffGzipped = getDiff(usage.gzip, prevUsage?.gzip)
      const diffBrotli = getDiff(usage.brotli, prevUsage?.brotli)

      return [
        usage.name,
        `${prettyBytes(usage.size)}${diffSize}`,
        `${prettyBytes(usage.gzip)}${diffGzipped}`,
        `${prettyBytes(usage.brotli)}${diffBrotli}`,
      ]
    })
    .filter(usage => !!usage)

  output += `${markdownTable([['Name', ...sizeHeaders], ...data])}\n\n`
}

/**
 * Imports JSON data from a specified path
 *
 * @template T
 * @param {string} filePath - Path to the JSON file
 * @returns {Promise<T | undefined>} The JSON content or undefined if the file does not exist
 */
async function importJSON(filePath) {
  if (!existsSync(filePath)) return undefined
  return (await import(filePath, { assert: { type: 'json' } })).default
}

/**
 * Calculates the difference between the current and previous sizes
 *
 * @param {number} curr - The current size
 * @param {number} [prev] - The previous size
 * @returns {string} The difference in pretty format
 */
function getDiff(curr, prev) {
  if (prev === undefined) return ''
  const diff = curr - prev
  if (diff === 0) return ''
  const sign = diff > 0 ? '+' : ''
  return ` (**${sign}${prettyBytes(diff)}**)`
}
