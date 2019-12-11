const args = require('minimist')(process.argv.slice(2))
const fs = require('fs')
const path = require('path')
const semver = require('semver')
const currentVersion = require('../package.json').version
const { prompt } = require('enquirer')
const execa = require('execa')

const preId = args.preid || semver.prerelease(currentVersion)[0] || 'alpha'
const isDryRun = args.dry
const skipTests = args.skipTests
const skipBuild = args.skipBuild
const packages = fs
  .readdirSync(path.resolve(__dirname, '../packages'))
  .filter(p => !p.endsWith('.ts') && !p.startsWith('.'))

const versionIncrements = [
  'patch',
  'minor',
  'major',
  'prepatch',
  'preminor',
  'premajor',
  'prerelease'
]

const inc = i => semver.inc(currentVersion, i, preId)
const bin = name => path.resolve(__dirname, '../node_modules/.bin/' + name)
const run = (bin, args, opts = {}) =>
  execa(bin, args, { stdio: 'inherit', ...opts })
const getPkgRoot = pkg => path.resolve(__dirname, '../packages/' + pkg)

async function main() {
  let targetVersion = args._[0]

  if (!targetVersion) {
    // no explicit version, offer suggestions
    const { release } = await prompt({
      type: 'select',
      name: 'release',
      message: 'Select release type',
      choices: versionIncrements.map(i => `${i} (${inc(i)})`).concat(['custom'])
    })

    if (release === 'custom') {
      targetVersion = (await prompt({
        type: 'input',
        name: 'version',
        message: 'Input custom version',
        initial: currentVersion
      })).version
    } else {
      targetVersion = release.match(/\((.*)\)/)[1]
    }
  }

  if (!semver.valid(targetVersion)) {
    throw new Error(`invalid target version: ${targetVersion}`)
  }

  const { yes } = await prompt({
    type: 'confirm',
    name: 'yes',
    message: `Releasing v${targetVersion}. Confirm?`
  })

  if (!yes) {
    return
  }

  // run tests before release
  if (!skipTests) {
    await run(bin('jest'), ['--clearCache'])
    await run('yarn', ['test'])
  }

  // update all package versions and inter-dependencies
  updateVersions(targetVersion)

  // build all packages with types
  if (!skipBuild) {
    await run('yarn', ['build', '--release'])
    // test generated dts files
    await run(bin('tsd'))
  }

  // all good...
  if (isDryRun) {
    // stop here so we can inspect changes to be committed
    // and packages built
    console.log('Dry run finished.')
  } else {
    // commit all changes
    console.log('Committing changes...')
    await run('git', ['add', '-A'])
    await run('git', ['commit', '-m', `release: v${targetVersion}`])

    // publish packages
    const releaseTag = semver.prerelease(targetVersion)[0] || 'latest'
    for (const pkg of packagesToPublish) {
      await publish(pkg, releaseTag)
    }

    // push to GitHub
    await run('git', ['tag', `v${targetVersion}`])
    await run('git', ['push', 'origin', `refs/tags/v${targetVersion}`])
    await run('git', ['push'])
  }
}

function updateVersions(version) {
  console.log('Updating versions...')
  // 1. update root package.json
  updatePackage(path.resolve(__dirname, '..'), version)
  // 2. update all packages
  packages.forEach(p => updatePackage(getPkgRoot(p), version))
}

function updatePackage(pkgRoot, version) {
  const pkg = readPkg(pkgRoot)
  pkg.version = version
  if (pkg.dependencies) {
    Object.keys(pkg.dependencies).forEach(dep => {
      if (
        dep.startsWith('@vue') &&
        packages.includes(dep.replace(/^@vue\//, ''))
      ) {
        pkg.dependencies[dep] = version
      }
    })
  }
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
}

function readPkg(pkgRoot) {
  const pkgPath = path.resolve(pkgRoot, 'package.json')
  return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
}

async function publish(pkgName, releaseTag) {
  const pkgRoot = getPkgRoot(pkgName)
  const pkg = readPkg(pkgRoot)
  if (!pkg.private) {
    await run('npm', ['publish', '--tag', releaseTag], {
      cwd: pkgRoot
    })
  }
}

main().catch(err => {
  console.error(err)
})
