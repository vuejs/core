// @ts-check
import fs from 'node:fs'
import path from 'node:path'
import pico from 'picocolors'
import semver from 'semver'
import enquirer from 'enquirer'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { exec, getSha } from './utils.js'
import { parseArgs } from 'node:util'

/**
 * @typedef {{
 *   name: string
 *   version: string
 *   dependencies?: { [dependenciesPackageName: string]: string }
 *   peerDependencies?: { [peerDependenciesPackageName: string]: string }
 * }} Package
 */

let versionUpdated = false

const { prompt } = enquirer
const currentVersion = createRequire(import.meta.url)('../package.json').version
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    preid: {
      type: 'string',
    },
    dry: {
      type: 'boolean',
    },
    tag: {
      type: 'string',
    },
    canary: {
      type: 'boolean',
    },
    skipBuild: {
      type: 'boolean',
    },
    skipTests: {
      type: 'boolean',
    },
    skipGit: {
      type: 'boolean',
    },
    skipPrompts: {
      type: 'boolean',
    },
    publish: {
      type: 'boolean',
      default: false,
    },
    publishOnly: {
      type: 'boolean',
    },
    registry: {
      type: 'string',
    },
  },
})

const preId = args.preid || semver.prerelease(currentVersion)?.[0]
const isDryRun = args.dry
/** @type {boolean | undefined} */
let skipTests = args.skipTests
const skipBuild = args.skipBuild
const isCanary = args.canary
const skipPrompts = args.skipPrompts || args.canary
const skipGit = args.skipGit || args.canary

const packages = fs
  .readdirSync(path.resolve(__dirname, '../packages'))
  .filter(p => {
    const pkgRoot = path.resolve(__dirname, '../packages', p)
    if (fs.statSync(pkgRoot).isDirectory()) {
      const pkg = JSON.parse(
        fs.readFileSync(path.resolve(pkgRoot, 'package.json'), 'utf-8'),
      )
      return !pkg.private
    }
  })

const isCorePackage = (/** @type {string} */ pkgName) => {
  if (!pkgName) return

  if (pkgName === 'vue' || pkgName === '@vue/compat') {
    return true
  }

  return (
    pkgName.startsWith('@vue') &&
    packages.includes(pkgName.replace(/^@vue\//, ''))
  )
}

const renamePackageToCanary = (/** @type {string} */ pkgName) => {
  if (pkgName === 'vue') {
    return '@vue/canary'
  }

  if (isCorePackage(pkgName)) {
    return `${pkgName}-canary`
  }

  return pkgName
}

const keepThePackageName = (/** @type {string} */ pkgName) => pkgName

/** @type {string[]} */
const skippedPackages = []

/** @type {ReadonlyArray<import('semver').ReleaseType>} */
const versionIncrements = [
  'patch',
  'minor',
  'major',
  ...(preId
    ? /** @type {const} */ (['prepatch', 'preminor', 'premajor', 'prerelease'])
    : []),
]

const inc = (/** @type {import('semver').ReleaseType} */ i) =>
  semver.inc(currentVersion, i, typeof preId === 'string' ? preId : undefined)
const run = async (
  /** @type {string} */ bin,
  /** @type {ReadonlyArray<string>} */ args,
  /** @type {import('node:child_process').SpawnOptions} */ opts = {},
) => exec(bin, args, { stdio: 'inherit', ...opts })
const dryRun = async (
  /** @type {string} */ bin,
  /** @type {ReadonlyArray<string>} */ args,
  /** @type {import('node:child_process').SpawnOptions} */ opts = {},
) => console.log(pico.blue(`[dryrun] ${bin} ${args.join(' ')}`), opts)
const runIfNotDry = isDryRun ? dryRun : run
const getPkgRoot = (/** @type {string} */ pkg) =>
  path.resolve(__dirname, '../packages/' + pkg)
const step = (/** @type {string} */ msg) => console.log(pico.cyan(msg))

async function main() {
  if (!(await isInSyncWithRemote())) {
    return
  } else {
    console.log(`${pico.green(`✓`)} commit is up-to-date with remote.\n`)
  }

  let targetVersion = positionals[0]

  if (isCanary) {
    // The canary version string format is `3.yyyyMMdd.0` (or `3.yyyyMMdd.0-minor.0` for minor)
    // Use UTC date so that it's consistent across CI and maintainers' machines
    const date = new Date()
    const yyyy = date.getUTCFullYear()
    const MM = (date.getUTCMonth() + 1).toString().padStart(2, '0')
    const dd = date.getUTCDate().toString().padStart(2, '0')

    const major = semver.major(currentVersion)
    const datestamp = `${yyyy}${MM}${dd}`
    let canaryVersion

    canaryVersion = `${major}.${datestamp}.0`
    if (args.tag && args.tag !== 'latest') {
      canaryVersion = `${major}.${datestamp}.0-${args.tag}.0`
    }

    // check the registry to avoid version collision
    // in case we need to publish more than one canary versions in a day
    try {
      const pkgName = renamePackageToCanary('vue')
      const { stdout } = await run(
        'pnpm',
        ['view', `${pkgName}@~${canaryVersion}`, 'version', '--json'],
        { stdio: 'pipe' },
      )
      let versions = JSON.parse(/** @type {string} */ (stdout))
      versions = Array.isArray(versions) ? versions : [versions]
      const latestSameDayPatch = /** @type {string} */ (
        semver.maxSatisfying(versions, `~${canaryVersion}`)
      )

      canaryVersion = /** @type {string} */ (
        semver.inc(latestSameDayPatch, 'patch')
      )
      if (args.tag && args.tag !== 'latest') {
        canaryVersion = /** @type {string} */ (
          semver.inc(latestSameDayPatch, 'prerelease', args.tag)
        )
      }
    } catch (/** @type {any} */ e) {
      if (/E404/.test(e.message)) {
        // the first patch version on that day
      } else {
        throw e
      }
    }

    targetVersion = canaryVersion
  }

  if (!targetVersion) {
    // no explicit version, offer suggestions
    /** @type {{ release: string }} */
    const { release } = await prompt({
      type: 'select',
      name: 'release',
      message: 'Select release type',
      choices: versionIncrements
        .map(i => `${i} (${inc(i)})`)
        .concat(['custom']),
    })

    if (release === 'custom') {
      /** @type {{ version: string }} */
      const result = await prompt({
        type: 'input',
        name: 'version',
        message: 'Input custom version',
        initial: currentVersion,
      })
      targetVersion = result.version
    } else {
      targetVersion = release.match(/\((.*)\)/)?.[1] ?? ''
    }
  }

  // @ts-expect-error
  if (versionIncrements.includes(targetVersion)) {
    // @ts-expect-error
    targetVersion = inc(targetVersion)
  }

  if (!semver.valid(targetVersion)) {
    throw new Error(`invalid target version: ${targetVersion}`)
  }

  if (skipPrompts) {
    step(
      isCanary
        ? `Releasing canary version v${targetVersion}...`
        : `Releasing v${targetVersion}...`,
    )
  } else {
    /** @type {{ yes: boolean }} */
    const { yes: confirmRelease } = await prompt({
      type: 'confirm',
      name: 'yes',
      message: `Releasing v${targetVersion}. Confirm?`,
    })

    if (!confirmRelease) {
      return
    }
  }

  await runTestsIfNeeded()

  // update all package versions and inter-dependencies
  step('\nUpdating cross dependencies...')
  updateVersions(
    targetVersion,
    isCanary ? renamePackageToCanary : keepThePackageName,
  )
  versionUpdated = true

  // generate changelog
  step('\nGenerating changelog...')
  await run(`pnpm`, ['run', 'changelog'])

  if (!skipPrompts) {
    /** @type {{ yes: boolean }} */
    const { yes: changelogOk } = await prompt({
      type: 'confirm',
      name: 'yes',
      message: `Changelog generated. Does it look good?`,
    })

    if (!changelogOk) {
      return
    }
  }

  // update pnpm-lock.yaml
  // skipped during canary release because the package names changed and installing with `workspace:*` would fail
  if (!isCanary) {
    step('\nUpdating lockfile...')
    await run(`pnpm`, ['install', '--prefer-offline'])
  }

  if (!skipGit) {
    const { stdout } = await run('git', ['diff'], { stdio: 'pipe' })
    if (stdout) {
      step('\nCommitting changes...')
      await runIfNotDry('git', ['add', '-A'])
      await runIfNotDry('git', ['commit', '-m', `release: v${targetVersion}`])
    } else {
      console.log('No changes to commit.')
    }
  }

  // publish packages
  if (args.publish) {
    await buildPackages()
    await publishPackages(targetVersion)
  }

  // push to GitHub
  if (!skipGit) {
    step('\nPushing to GitHub...')
    await runIfNotDry('git', ['tag', `v${targetVersion}`])
    await runIfNotDry('git', ['push', 'origin', `refs/tags/v${targetVersion}`])
    await runIfNotDry('git', ['push'])
  }

  if (!args.publish) {
    console.log(
      pico.yellow(
        '\nRelease will be done via GitHub Actions.\n' +
          'Check status at https://github.com/vuejs/core/actions/workflows/release.yml',
      ),
    )
  }

  if (isDryRun) {
    console.log(`\nDry run finished - run git diff to see package changes.`)
  }

  if (skippedPackages.length) {
    console.log(
      pico.yellow(
        `The following packages are skipped and NOT published:\n- ${skippedPackages.join(
          '\n- ',
        )}`,
      ),
    )
  }
  console.log()
}

async function runTestsIfNeeded() {
  if (!skipTests) {
    step('Checking CI status for HEAD...')
    let isCIPassed = await getCIResult()
    skipTests ||= isCIPassed

    if (isCIPassed) {
      if (!skipPrompts) {
        /** @type {{ yes: boolean }} */
        const { yes: promptSkipTests } = await prompt({
          type: 'confirm',
          name: 'yes',
          message: `CI for this commit passed. Skip local tests?`,
        })
        skipTests = promptSkipTests
      } else {
        skipTests = true
      }
    } else if (skipPrompts) {
      throw new Error(
        'CI for the latest commit has not passed yet. ' +
          'Only run the release workflow after the CI has passed.',
      )
    }
  }

  if (!skipTests) {
    step('\nRunning tests...')
    if (!isDryRun) {
      await run('pnpm', ['run', 'test', '--run'])
    } else {
      console.log(`Skipped (dry run)`)
    }
  } else {
    step('Tests skipped.')
  }
}

async function getCIResult() {
  try {
    const sha = await getSha()
    const res = await fetch(
      `https://api.github.com/repos/vuejs/core/actions/runs?head_sha=${sha}` +
        `&status=success&exclude_pull_requests=true`,
    )
    /** @type {{ workflow_runs: ({ name: string, conclusion: string })[] }} */
    const data = await res.json()
    return data.workflow_runs.some(({ name, conclusion }) => {
      return name === 'ci' && conclusion === 'success'
    })
  } catch {
    console.error('Failed to get CI status for current commit.')
    return false
  }
}

async function isInSyncWithRemote() {
  try {
    const branch = await getBranch()
    const res = await fetch(
      `https://api.github.com/repos/vuejs/core/commits/${branch}?per_page=1`,
    )
    const data = await res.json()
    if (data.sha === (await getSha())) {
      return true
    } else {
      /** @type {{ yes: boolean }} */
      const { yes } = await prompt({
        type: 'confirm',
        name: 'yes',
        message: pico.red(
          `Local HEAD is not up-to-date with remote. Are you sure you want to continue?`,
        ),
      })
      return yes
    }
  } catch {
    console.error(
      pico.red('Failed to check whether local HEAD is up-to-date with remote.'),
    )
    return false
  }
}

async function getBranch() {
  return (await exec('git', ['rev-parse', '--abbrev-ref', 'HEAD'])).stdout
}

/**
 * @param {string} version
 * @param {(pkgName: string) => string} getNewPackageName
 */
function updateVersions(version, getNewPackageName = keepThePackageName) {
  // 1. update root package.json
  updatePackage(path.resolve(__dirname, '..'), version, getNewPackageName)
  // 2. update all packages
  packages.forEach(p =>
    updatePackage(getPkgRoot(p), version, getNewPackageName),
  )
}

/**
 * @param {string} pkgRoot
 * @param {string} version
 * @param {(pkgName: string) => string} getNewPackageName
 */
function updatePackage(pkgRoot, version, getNewPackageName) {
  const pkgPath = path.resolve(pkgRoot, 'package.json')
  /** @type {Package} */
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  pkg.name = getNewPackageName(pkg.name)
  pkg.version = version
  if (isCanary) {
    updateDeps(pkg, 'dependencies', version, getNewPackageName)
    updateDeps(pkg, 'peerDependencies', version, getNewPackageName)
  }
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
}

/**
 * @param {Package} pkg
 * @param {'dependencies' | 'peerDependencies'} depType
 * @param {string} version
 * @param {(pkgName: string) => string} getNewPackageName
 */
function updateDeps(pkg, depType, version, getNewPackageName) {
  const deps = pkg[depType]
  if (!deps) return
  Object.keys(deps).forEach(dep => {
    if (isCorePackage(dep)) {
      const newName = getNewPackageName(dep)
      const newVersion = newName === dep ? version : `npm:${newName}@${version}`
      console.log(
        pico.yellow(`${pkg.name} -> ${depType} -> ${dep}@${newVersion}`),
      )
      deps[dep] = newVersion
    }
  })
}

async function buildPackages() {
  step('\nBuilding all packages...')
  if (!skipBuild) {
    await run('pnpm', ['run', 'build', '--withTypes'])
  } else {
    console.log(`(skipped)`)
  }
}

/**
 * @param {string} version
 */
async function publishPackages(version) {
  // publish packages
  step('\nPublishing packages...')

  const additionalPublishFlags = []
  if (isDryRun) {
    additionalPublishFlags.push('--dry-run')
  }
  if (isDryRun || skipGit || process.env.CI) {
    additionalPublishFlags.push('--no-git-checks')
  }
  // add provenance metadata when releasing from CI
  // canary release commits are not pushed therefore we don't need to add provenance
  // also skip provenance if not publishing to actual npm
  if (process.env.CI && !isCanary && !args.registry) {
    additionalPublishFlags.push('--provenance')
  }

  for (const pkg of packages) {
    await publishPackage(pkg, version, additionalPublishFlags)
  }
}

/**
 * @param {string} pkgName
 * @param {string} version
 * @param {ReadonlyArray<string>} additionalFlags
 */
async function publishPackage(pkgName, version, additionalFlags) {
  if (skippedPackages.includes(pkgName)) {
    return
  }

  let releaseTag = null
  if (args.tag) {
    releaseTag = args.tag
  } else if (version.includes('alpha')) {
    releaseTag = 'alpha'
  } else if (version.includes('beta')) {
    releaseTag = 'beta'
  } else if (version.includes('rc')) {
    releaseTag = 'rc'
  }

  step(`Publishing ${pkgName}...`)
  try {
    // Don't change the package manager here as we rely on pnpm to handle
    // workspace:* deps
    await run(
      'pnpm',
      [
        'publish',
        ...(releaseTag ? ['--tag', releaseTag] : []),
        '--access',
        'public',
        ...(args.registry ? ['--registry', args.registry] : []),
        ...additionalFlags,
      ],
      {
        cwd: getPkgRoot(pkgName),
        stdio: 'pipe',
      },
    )
    console.log(pico.green(`Successfully published ${pkgName}@${version}`))
  } catch (/** @type {any} */ e) {
    if (e.message?.match(/previously published/)) {
      console.log(pico.red(`Skipping already published: ${pkgName}`))
    } else {
      throw e
    }
  }
}

async function publishOnly() {
  const targetVersion = positionals[0]
  if (targetVersion) {
    updateVersions(targetVersion)
  }
  await buildPackages()
  await publishPackages(currentVersion)
}

const fnToRun = args.publishOnly ? publishOnly : main

fnToRun().catch(err => {
  if (versionUpdated) {
    // revert to current version on failed releases
    updateVersions(currentVersion)
  }
  console.error(err)
  process.exit(1)
})
