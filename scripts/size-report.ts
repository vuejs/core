import path from 'node:path'
import { markdownTable } from 'markdown-table'
import prettyBytes from 'pretty-bytes'
import { readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'

interface SizeResult {
  size: number
  gzip: number
  brotli: number
}

interface BundleResult extends SizeResult {
  file: string
}

type ExportResult = Record<string, SizeResult & { name: string }>

const currDir = path.resolve('temp/size')
const prevDir = path.resolve('temp/size-prev')
let output = '## Size Report\n\n'

run()

async function run() {
  await renderFiles()
  await processExports()
  await renderBaseline()

  process.stdout.write(output)
}

async function renderFiles() {
  const filterFiles = (files: string[]) =>
    files.filter(file => !file.startsWith('_'))

  const curr = filterFiles(await readdir(currDir))
  const prev = existsSync(prevDir) ? filterFiles(await readdir(prevDir)) : []
  const fileList = new Set([...curr, ...prev])

  const rows: string[][] = []
  for (const file of fileList) {
    const currPath = path.resolve(currDir, file)
    const prevPath = path.resolve(prevDir, file)

    const curr = await importJSON<BundleResult>(currPath)
    const prev = await importJSON<BundleResult>(prevPath)
    const fileName = curr?.file || prev?.file || ''

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
  const curr = (await importJSON<SizeResult>(
    path.resolve(currDir, '_baseline.json')
  ))!
  const prev = await importJSON<SizeResult>(
    path.resolve(prevDir, '_baseline.json')
  )
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
  const curr = (await importJSON<ExportResult>(
    path.resolve(currDir, '_exports.json')
  ))!
  const prev = await importJSON<ExportResult>(
    path.resolve(prevDir, '_exports.json')
  )
  output += '\n### Exports\n\n'
  output += `${renderExports(curr, prev)}\n\n`
}

function renderExports(exports: ExportResult, prev?: ExportResult) {
  const data = Object.values(exports)
    .map(exp => {
      const prevExport = prev?.[exp.name]
      const diffSize = getDiff(exp.size, prevExport?.size)
      const diffGzipped = getDiff(exp.gzip, prevExport?.gzip)
      const diffBrotli = getDiff(exp.brotli, prevExport?.brotli)

      return [
        exp.name,
        `${prettyBytes(exp.size)}${diffSize}`,
        `${prettyBytes(exp.gzip)}${diffGzipped}`,
        `${prettyBytes(exp.brotli)}${diffBrotli}`
      ]
    })
    .filter((exp): exp is string[] => !!exp)
  if (data.length === 0) return 'No changes'
  return markdownTable([['Name', 'Size', 'Minified', 'Brotli'], ...data])
}

async function importJSON<T>(path: string): Promise<T | undefined> {
  if (!existsSync(path)) return undefined
  return (await import(path, { assert: { type: 'json' } })).default
}

function getDiff(curr: number, prev?: number) {
  if (prev === undefined) return ''
  const diff = curr - prev
  if (diff === 0) return ''
  const sign = diff > 0 ? '+' : ''
  return ` (**${sign}${prettyBytes(diff)}**)`
}
