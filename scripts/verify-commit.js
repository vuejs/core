// @ts-check
import pico from 'picocolors'
import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const gitPath = path.resolve('.git')
const gitStat = statSync(gitPath)

let msgPath
const commitMsgFile = 'COMMIT_EDITMSG'
if (gitStat.isDirectory()) {
  msgPath = path.resolve(gitPath, commitMsgFile)
} else {
  const gitDir = readFileSync(gitPath, 'utf-8').replace('gitdir:', '').trim()
  msgPath = path.resolve(gitDir, commitMsgFile)
}

const msg = readFileSync(msgPath, 'utf-8').trim()

const commitRE =
  /^(revert: )?(feat|fix|docs|dx|style|refactor|perf|test|workflow|build|ci|chore|types|wip|release)(\(.+\))?: .{1,50}/

if (!commitRE.test(msg)) {
  console.log()
  console.error(
    `  ${pico.white(pico.bgRed(' ERROR '))} ${pico.red(
      `invalid commit message format.`,
    )}\n\n` +
      pico.red(
        `  Proper commit message format is required for automated changelog generation. Examples:\n\n`,
      ) +
      `    ${pico.green(`feat(compiler): add 'comments' option`)}\n` +
      `    ${pico.green(
        `fix(v-model): handle events on blur (close #28)`,
      )}\n\n` +
      pico.red(`  See .github/commit-convention.md for more details.\n`),
  )
  process.exit(1)
}
