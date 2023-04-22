// @ts-check
import minimist from 'minimist'
import fs from 'node:fs'
import path from 'node:path'
import chalk from 'chalk'
import semver from 'semver'
import enquirer from 'enquirer'
import execa from 'execa'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const { prompt } = enquirer
const currentVersion = createRequire(import.meta.url)('../package.json').version
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const args = minimist(process.argv.slice(2))
const preId = args.preid || semver.prerelease(currentVersion)?.[0]
const isDryRun = args.dry
let skipTests = args.skipTests
const skipBuild = args.skipBuild
const isCanary = args.canary
const skipPrompts = args.skipPrompts || args.canary
const skipGit = args.skipGit || args.canary

const packages = fs
  .readdirSync(path.resolve(__dirname, '../packages'))
  .filter(p => !p.endsWith('.ts') && !p.startsWith('.'))

const isCorePackage = pkgName => {
  if (!pkgName) return

  if (pkgName === 'vue' || pkgName === '@vue/compat') {
    return true
  }

  return (
    pkgName.startsWith('@vue') &&
    packages.includes(pkgName.replace(/^@vue\//, ''))
  )
}

const renamePackageToCanary = pkgName => {
  if (pkgName === 'vue') {
    return '@vue/canary'
  }

  if (isCorePackage(pkgName)) {
    return `${pkgName}-canary`
  }

  return pkgName
}

const keepThePackageName = pkgName => pkgName

const skippedPackages = []

const versionIncrements = [
  'patch',
  'minor',
  'major',
  ...(preId ? ['prepatch', 'preminor', 'premajor', 'prerelease'] : [])
]

const inc = i => semver.inc(currentVersion, i, preId)
const run = (bin, args, opts = {}) =>
  execa(bin, args, { stdio: 'inherit', ...opts })
const dryRun = (bin, args, opts = {}) =>
  console.log(chalk.blue(`[dryrun] ${bin} ${args.join(' ')}`), opts)
const runIfNotDry = isDryRun ? dryRun : run
const getPkgRoot = pkg => path.resolve(__dirname, '../packages/' + pkg)
const step = msg => console.log(chalk.cyan(msg))

async function main() {
  let targetVersion = args._[0]

  if (isCanary) {
    // The canary version string format is `3.yyyyMMdd.0`.
    // Use UTC date so that it's consistent across CI and maintainers' machines
    const date = new Date()
    const yyyy = date.getUTCFullYear()
    const MM = (date.getUTCMonth() + 1).toString().padStart(2, '0')
    const dd = date.getUTCDate().toString().padStart(2, '0')

    const major = semver.major(currentVersion)
    const minor = `${yyyy}${MM}${dd}`
    const patch = 0
    let canaryVersion = `${major}.${minor}.${patch}`

    // check the registry to avoid version collision
    // in case we need to publish more than one canary versions in a day
    try {
      const pkgName = renamePackageToCanary('vue')
      const { stdout } = await run(
        'pnpm',
        ['view', `${pkgName}@~${canaryVersion}`, 'version', '--json'],
        { stdio: 'pipe' }
      )
      let versions = JSON.parse(stdout)
      versions = Array.isArray(versions) ? versions : [versions]
      const latestSameDayPatch = /** @type {string} */ (
        semver.maxSatisfying(versions, `~${canaryVersion}`)
      )
      canaryVersion = /** @type {string} */ (
        semver.inc(latestSameDayPatch, 'patch')
      )
    } catch (e) {
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
    // @ts-ignore
    const { release } = await prompt({
      type: 'select',
      name: 'release',
      message: 'Select release type',
      choices: versionIncrements.map(i => `${i} (${inc(i)})`).concat(['custom'])
    })

    if (release === 'custom') {
      const result = await prompt({
        type: 'input',
        name: 'version',
        message: 'Input custom version',
        initial: currentVersion
      })
      // @ts-ignore
      targetVersion = result.version
    } else {
      targetVersion = release.match(/\((.*)\)/)[1]
    }
  }

  if (!semver.valid(targetVersion)) {
    throw new Error(`invalid target version: ${targetVersion}`)
  }

  if (skipPrompts) {
    step(
      isCanary
        ? `Releasing canary version v${targetVersion}...`
        : `Releasing v${targetVersion}...`
    )
  } else {
    // @ts-ignore
    const { yes: confirmRelease } = await prompt({
      type: 'confirm',
      name: 'yes',
      message: `Releasing v${targetVersion}. Confirm?`
    })

    if (!confirmRelease) {
      return
    }
  }

  if (!skipTests) {
    step('Checking CI status for HEAD...')
    let isCIPassed = await getCIResult()
    skipTests ||= isCIPassed

    if (isCIPassed && !skipPrompts) {
      // @ts-ignore
      const { yes: promptSkipTests } = await prompt({
        type: 'confirm',
        name: 'yes',
        message: `CI for this commit passed. Skip local tests?`
      })

      skipTests = promptSkipTests
    }
  }

  if (!skipTests) {
    step('\nRunning tests...')
    if (!isDryRun) {
      await run('pnpm', ['test', 'run'])
    } else {
      console.log(`Skipped (dry run)`)
    }
  } else {
    step('Tests skipped.')
  }

  // update all package versions and inter-dependencies
  step('\nUpdating cross dependencies...')
  updateVersions(
    targetVersion,
    isCanary ? renamePackageToCanary : keepThePackageName
  )

  // build all packages with types
  step('\nBuilding all packages...')
  if (!skipBuild && !isDryRun) {
    await run('pnpm', ['run', 'build', '--withTypes'])
    step('\nTesting built types...')
    await run('pnpm', ['test-dts-only'])
  } else {
    console.log(`(skipped)`)
  }

  // generate changelog
  step('\nGenerating changelog...')
  await run(`pnpm`, ['run', 'changelog'])

  if (!skipPrompts) {
    // @ts-ignore
    const { yes: changelogOk } = await prompt({
      type: 'confirm',
      name: 'yes',
      message: `Changelog generated. Does it look good?`
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
  step('\nPublishing packages...')
  for (const pkg of packages) {
    await publishPackage(pkg, targetVersion)
  }

  // push to GitHub
  if (!skipGit) {
    step('\nPushing to GitHub...')
    await runIfNotDry('git', ['tag', `v${targetVersion}`])
    await runIfNotDry('git', ['push', 'origin', `refs/tags/v${targetVersion}`])
    await runIfNotDry('git', ['push'])
  }

  if (isDryRun) {
    console.log(`\nDry run finished - run git diff to see package changes.`)
  }

  if (skippedPackages.length) {
    console.log(
      chalk.yellow(
        `The following packages are skipped and NOT published:\n- ${skippedPackages.join(
          '\n- '
        )}`
      )
    )
  }
  console.log()
}

async function getCIResult() {
  try {
    const { stdout: sha } = await execa('git', ['rev-parse', 'HEAD'])
    const res = await fetch(
      `https://api.github.com/repos/vuejs/core/actions/runs?head_sha=${sha}` +
        `&status=success&exclude_pull_requests=true`
    )
    const data = await res.json()
    return data.workflow_runs.length > 0
  } catch (e) {
    return false
  }
}

function updateVersions(version, getNewPackageName = keepThePackageName) {
  // 1. update root package.json
  updatePackage(path.resolve(__dirname, '..'), version, getNewPackageName)
  // 2. update all packages
  packages.forEach(p =>
    updatePackage(getPkgRoot(p), version, getNewPackageName)
  )
}

function updatePackage(pkgRoot, version, getNewPackageName) {
  const pkgPath = path.resolve(pkgRoot, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  pkg.name = getNewPackageName(pkg.name)
  pkg.version = version
  updateDeps(pkg, 'dependencies', version, getNewPackageName)
  updateDeps(pkg, 'peerDependencies', version, getNewPackageName)
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
}

function updateDeps(pkg, depType, version, getNewPackageName) {
  const deps = pkg[depType]
  if (!deps) return
  Object.keys(deps).forEach(dep => {
    if (deps[dep] === 'workspace:*') {
      return
    }
    if (isCorePackage(dep)) {
      const newName = getNewPackageName(dep)
      const newVersion = newName === dep ? version : `npm:${newName}@${version}`
      console.log(
        chalk.yellow(`${pkg.name} -> ${depType} -> ${dep}@${newVersion}`)
      )
      deps[dep] = newVersion
    }
  })
}

async function publishPackage(pkgName, version) {
  if (skippedPackages.includes(pkgName)) {
    return
  }
  const pkgRoot = getPkgRoot(pkgName)
  const pkgPath = path.resolve(pkgRoot, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  if (pkg.private) {
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
    await run(
      // note: use of yarn is intentional here as we rely on its publishing
      // behavior.
      'npm',
      [
        'publish',
        ...(releaseTag ? ['--tag', releaseTag] : []),
        '--access',
        'public',
        ...(isDryRun ? ['--dry-run'] : [])
      ],
      {
        cwd: pkgRoot,
        stdio: 'pipe'
      }
    )
    console.log(chalk.green(`Successfully published ${pkgName}@${version}`))
  } catch (e) {
    if (e.stderr.match(/previously published/)) {
      console.log(chalk.red(`Skipping already published: ${pkgName}`))
    } else {
      throw e
    }
  }
}

main().catch(err => {
  updateVersions(currentVersion)
  console.error(err)
  process.exit(1)
})
