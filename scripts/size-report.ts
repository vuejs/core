// @ts-check
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

interface UsageResult extends SizeResult {
  name: string
}

const currDir: string = path.resolve('temp/size')
const prevDir: string = path.resolve('temp/size-prev')
let output = '## Size Report\n\n'
const sizeHeaders = ['Size', 'Gzip', 'Brotli']

run()

async function run(): Promise<void> {
  await renderFiles()
  await renderUsages()

  process.stdout.write(output)
}

async function renderFiles(): Promise<void> {
  const filterFiles = (files: string[]): string[] =>
    files.filter(file => file[0] !== '_' && !file.endsWith('.txt'))

  const curr = filterFiles(await readdir(currDir))
  const prev = existsSync(prevDir) ? filterFiles(await readdir(prevDir)) : []
  const fileList = new Set([...curr, ...prev])

  const rows: (string | number)[][] = []
  for (const file of fileList) {
    const currPath = path.resolve(currDir, file)
    const prevPath = path.resolve(prevDir, file)

    const currData = await importJSON<BundleResult>(currPath)
    const prevData = await importJSON<BundleResult>(prevPath)
    const fileName = currData?.file || prevData?.file || ''

    if (!currData) {
      rows.push([`~~${fileName}~~`])
    } else {
      rows.push([
        fileName,
        `${prettyBytes(currData.size)}${getDiff(currData.size, prevData?.size)}`,
        `${prettyBytes(currData.gzip)}${getDiff(currData.gzip, prevData?.gzip)}`,
        `${prettyBytes(currData.brotli)}${getDiff(currData.brotli, prevData?.brotli)}`,
      ])
    }
  }

  output += '### Bundles\n\n'
  output += markdownTable([['File', ...sizeHeaders], ...rows] as readonly (
    string | null | undefined
  )[][])
  output += '\n\n'
}

async function renderUsages(): Promise<void> {
  const curr = await importJSON<Record<string, UsageResult>>(
    path.resolve(currDir, '_usages.json'),
  )
  const prev = await importJSON<Record<string, UsageResult>>(
    path.resolve(prevDir, '_usages.json'),
  )

  output += '\n### Usages\n\n'

  const data: (string | number)[][] = Object.values(curr ?? {})
    .map((usage: UsageResult): (string | number)[] => {
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
    .filter((usage): usage is (string | number)[] => !!usage)

  output += `${markdownTable([['Name', ...sizeHeaders], ...data] as readonly (string | null | undefined)[][])}\n\n`
}

async function importJSON<T>(filePath: string): Promise<T | undefined> {
  if (!existsSync(filePath)) return undefined
  return (await import(filePath, { with: { type: 'json' } })).default as T
}

function getDiff(curr: number, prev: number | undefined): string {
  if (prev === undefined) return ''
  const diff = curr - prev
  if (diff === 0) return ''
  const sign = diff > 0 ? '+' : ''
  return ` (**${sign}${prettyBytes(diff)}**)`
}
