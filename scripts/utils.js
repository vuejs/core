const fs = require('fs')

const targets = (exports.targets = fs.readdirSync('packages').filter(f => {
  return f !== 'shared' && fs.statSync(`packages/${f}`).isDirectory()
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
