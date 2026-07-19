import fs from 'node:fs'
import pico from 'picocolors'
import { createRequire } from 'node:module'
import { type SpawnOptions, spawn } from 'node:child_process'

const require = createRequire(import.meta.url)

export const targets: string[] = fs
  .readdirSync('packages')
  .filter(f => {
    if (
      !fs.statSync(`packages/${f}`).isDirectory() ||
      !fs.existsSync(`packages/${f}/package.json`)
    ) {
      return false
    }
    const pkg = require(`../packages/${f}/package.json`)
    return !(pkg.private && !pkg.buildOptions)
  })
  .concat('template-explorer')

export function fuzzyMatchTarget(
  partialTargets: ReadonlyArray<string>,
  includeAllMatching: boolean | undefined,
): string[] {
  const matched: string[] = []
  partialTargets.forEach(partialTarget => {
    for (const target of targets) {
      if (target.match(partialTarget)) {
        matched.push(target)
        if (!includeAllMatching) {
          break
        }
      }
    }
  })
  if (matched.length) {
    return matched
  } else {
    console.log()
    console.error(
      `  ${pico.white(pico.bgRed(' ERROR '))} ${pico.red(
        `Target ${pico.underline(partialTargets.toString())} not found!`,
      )}`,
    )
    console.log()

    process.exit(1)
  }
}

interface ExecResult {
  readonly ok: boolean
  readonly code: number | null
  readonly stderr: string
  readonly stdout: string
}

export async function exec(
  command: string,
  args: string[],
  opts: SpawnOptions = {},
): Promise<ExecResult> {
  return new Promise<ExecResult>((resolve, reject): void => {
    const _process = spawn(command, args, {
      stdio: [
        'ignore', // stdin
        'pipe', // stdout
        'pipe', // stderr
      ],
      shell: process.platform === 'win32',
      ...opts,
    })

    const stderrChunks: Buffer[] = []
    const stdoutChunks: Buffer[] = []

    _process.stderr?.on('data', chunk => {
      stderrChunks.push(chunk)
    })

    _process.stdout?.on('data', chunk => {
      stdoutChunks.push(chunk)
    })

    _process.on('error', error => {
      reject(error)
    })

    _process.on('exit', code => {
      const ok = code === 0
      const stderr = Buffer.concat(stderrChunks).toString().trim()
      const stdout = Buffer.concat(stdoutChunks).toString().trim()

      if (ok) {
        const result = { ok, code, stderr, stdout }
        resolve(result)
      } else {
        reject(
          new Error(
            `Failed to execute command: ${command} ${args.join(' ')}: ${stderr}`,
          ),
        )
      }
    })
  })
}
