// @ts-check
import fs from 'node:fs'
import path from 'node:path'
import pico from 'picocolors'
import semver from 'semver'
import enquirer from 'enquirer'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { exec } from './utils.js'
import { parseArgs } from 'node:util'

type Package = {
  name: string
  version: string
  dependencies?: { [dependenciesPackageName: string]: string }
  peerDependencies?: { [peerDependenciesPackageName: string]: string }
}

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

const preId: string | undefined =
  typeof args.preid === 'string'
    ? args.preid
    : typeof semver.prerelease(currentVersion)?.[0] === 'string'
      ? (semver.prerelease(currentVersion)?.[0] as string)
      : undefined
const isDryRun = args.dry
let skipTests: boolean | undefined = args.skipTests
const skipBuild = args.skipBuild
const skipPrompts = args.skipPrompts
const skipGit = args.skipGit

const packages = fs
  .readdirSync(path.resolve(__dirname, '../packages'))
  .filter(p => {
    const pkgRoot = path.resolve(__dirname, '../packages', p)
    const pkgPath = path.resolve(pkgRoot, 'package.json')
    if (!fs.statSync(pkgRoot).isDirectory() || !fs.existsSync(pkgPath)) {
      return false
    }

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    return !pkg.private
  })

const sortPackagesForPublishing = (packageNames: string[]) => [
  ...packageNames.filter(p => p !== 'vue'),
  ...packageNames.filter(p => p === 'vue'),
]

const keepThePackageName = (pkgName: string) => pkgName

const alreadyPublishedPackages: string[] = []

/** @type {ReadonlyArray<import('semver').ReleaseType>} */
const versionIncrements: Array<import('semver').ReleaseType> = [
  'patch',
  'minor',
  'major',
  ...(preId
    ? ([
        'prepatch',
        'preminor',
        'premajor',
        'prerelease',
      ] as import('semver').ReleaseType[])
    : []),
]

const inc = (i: import('semver').ReleaseType): string | null =>
  preId ? semver.inc(currentVersion, i, preId) : semver.inc(currentVersion, i)
const run = async (
  bin: string,
  args: ReadonlyArray<string>,
  opts: import('node:child_process').SpawnOptions = {},
): Promise<{ stdout: string; stderr: string }> =>
  exec(bin, [...args]) as Promise<{ stdout: string; stderr: string }>
const dryRun = async (
  bin: string,
  args: ReadonlyArray<string>,
  opts: import('node:child_process').SpawnOptions = {},
) => console.log(pico.blue(`[dryrun] ${bin} ${args.join(' ')}`), opts)
const runIfNotDry = isDryRun ? dryRun : run
const getPkgRoot = (/** @type {string} */ pkg: string) =>
  path.resolve(__dirname, '../packages/' + pkg)
const getPkgManifest = (/** @type {string} */ pkg: string) =>
  JSON.parse(
    fs.readFileSync(path.resolve(getPkgRoot(pkg), 'package.json'), 'utf-8'),
  )
const step = (msg: string | number | null | undefined) =>
  console.log(pico.cyan(msg))

async function main() {
  if (!(await isInSyncWithRemote())) {
    return
  } else {
    console.log(`${pico.green(`✓`)} commit is up-to-date with remote.\n`)
  }

  let targetVersion = positionals[0]

  if (!targetVersion) {
    // no explicit version, offer suggestions
    const { release }: { release: string } = await prompt({
      type: 'select',
      name: 'release',
      message: 'Select release type',
      choices: versionIncrements
        .map(i => `${i} (${inc(i)})`)
        .concat(['custom']),
    })

    if (release === 'custom') {
      const { version }: { version: string } = await prompt({
        type: 'input',
        name: 'version',
        message: 'Input custom version',
        initial: currentVersion,
      })
      targetVersion = version
    } else {
      targetVersion = release.match(/\((.*)\)/)?.[1] ?? ''
    }
  }

  if (
    versionIncrements.includes(targetVersion as import('semver').ReleaseType)
  ) {
    targetVersion = inc(targetVersion as import('semver').ReleaseType)!
  }

  if (!semver.valid(targetVersion!)) {
    throw new Error(`invalid target version: ${targetVersion}`)
  }

  if (skipPrompts) {
    step(`Releasing v${targetVersion}...`)
  } else {
    const { yes: confirmRelease }: { yes: boolean } = await prompt({
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
  updateVersions(targetVersion!, keepThePackageName)
  versionUpdated = true

  // generate changelog
  step('\nGenerating changelog...')
  await run(`pnpm`, ['run', 'changelog'])

  if (!skipPrompts) {
    const { yes: changelogOk }: { yes: boolean } = await prompt({
      type: 'confirm',
      name: 'yes',
      message: `Changelog generated. Does it look good?`,
    })

    if (!changelogOk) {
      return
    }
  }

  // update pnpm-lock.yaml
  step('\nUpdating lockfile...')
  await run(`pnpm`, ['install', '--prefer-offline'])

  if (!skipGit) {
    const { stdout }: { stdout: string } = await run('git', ['diff'], {
      stdio: 'pipe',
    })
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
    await runIfNotDry('git', ['tag', `v${targetVersion!}`])
    await runIfNotDry('git', ['push', 'origin', `refs/tags/v${targetVersion!}`])
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

  if (alreadyPublishedPackages.length) {
    console.log(
      pico.yellow(
        `The following packages already existed on the registry and were skipped:\n- ${alreadyPublishedPackages.join(
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
        const { yes: promptSkipTests }: { yes: boolean } = await prompt({
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
    const data: { workflow_runs: { name: string; conclusion: string }[] } =
      await res.json()
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
      const { yes }: { yes: boolean } = await prompt({
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

async function getSha(): Promise<string> {
  return (await exec('git', ['rev-parse', 'HEAD'])).stdout
}

async function getBranch(): Promise<string> {
  return (await exec('git', ['rev-parse', '--abbrev-ref', 'HEAD'])).stdout
}

function updateVersions(
  version: string,
  getNewPackageName: (pkgName: string) => string = keepThePackageName,
) {
  // 1. update root package.json
  updatePackage(path.resolve(__dirname, '..'), version, getNewPackageName)
  // 2. update all packages
  packages.forEach(p =>
    updatePackage(getPkgRoot(p), version, getNewPackageName),
  )
}

function updatePackage(
  pkgRoot: string,
  version: string,
  getNewPackageName: (pkgName: string) => string,
) {
  const pkgPath = path.resolve(pkgRoot, 'package.json')
  const pkg: Package = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  pkg.name = getNewPackageName(pkg.name)
  pkg.version = version
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
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
async function publishPackages(version: string) {
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
  // skip provenance if not publishing to actual npm
  if (process.env.CI && !args.registry) {
    additionalPublishFlags.push('--provenance')
  }

  for (const pkg of sortPackagesForPublishing(packages)) {
    await publishPackage(pkg, version, additionalPublishFlags)
  }
}

/**
 * @param {string} pkgName
 * @param {string} version
 * @param {ReadonlyArray<string>} additionalFlags
 */
async function publishPackage(
  pkgName: string,
  version: string,
  additionalFlags: ReadonlyArray<string>,
) {
  const packageName = getPkgManifest(pkgName).name

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

  if (!isDryRun && (await isPackagePublished(packageName, version))) {
    const pkgVersion = `${packageName}@${version}`
    console.log(pico.yellow(`Skipping already published: ${pkgVersion}`))
    alreadyPublishedPackages.push(pkgVersion)
    return
  }

  step(`Publishing ${packageName}...`)
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
    console.log(pico.green(`Successfully published ${packageName}@${version}`))
  } catch (e: unknown) {
    if (e instanceof Error && e.message?.match(/previously published/)) {
      const pkgVersion = `${packageName}@${version}`
      console.log(pico.red(`Skipping already published: ${pkgVersion}`))
      alreadyPublishedPackages.push(pkgVersion)
    } else {
      throw e
    }
  }
}

async function isPackagePublished(
  /** @type {string} */ packageName: string,
  /** @type {string} */ version: string,
) {
  try {
    await run(
      'npm',
      [
        'view',
        `${packageName}@${version}`,
        'version',
        ...(args.registry ? ['--registry', args.registry] : []),
      ],
      { stdio: 'pipe' },
    )
    return true
  } catch (e: unknown) {
    if (isPackageNotFoundError(e as Error)) {
      return false
    }
    throw e
  }
}

function isPackageNotFoundError(/** @type {Error} */ error: Error) {
  return /E404|No match found|No matching version|notarget/i.test(error.message)
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
