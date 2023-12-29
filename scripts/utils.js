// @ts-check
import fs from 'node:fs'
import pico from 'picocolors'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

export const targets = fs.readdirSync('packages').filter(f => {
  if (!fs.statSync(`packages/${f}`).isDirectory()) {
    return false
  }
  const pkg = require(`../packages/${f}/package.json`)
  if (pkg.private && !pkg.buildOptions) {
    return false
  }
  return true
})

/**
 *
 * @param {ReadonlyArray<string>} partialTargets
 * @param {boolean | undefined} includeAllMatching
 */
export function fuzzyMatchTarget(partialTargets, includeAllMatching) {
  /** @type {Array<string>} */
  const matched = []
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
