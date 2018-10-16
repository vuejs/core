const fs = require('fs')

const targets = (exports.targets = fs.readdirSync('packages').filter(f => {
  if (!fs.statSync(`packages/${f}`).isDirectory()) {
    return false
  }
  const pkg = require(`../packages/${f}/package.json`)
  if (pkg.private) {
    return false
  }
  return true
}))

exports.fuzzyMatchTarget = partialTarget => {
  const matched = []
  for (const target of targets) {
    if (target.match(partialTarget)) {
      matched.push(target)
    }
  }
  if (matched.length) {
    return matched
  } else {
    throw new Error(`Target ${partialTarget} not found!`)
  }
}
