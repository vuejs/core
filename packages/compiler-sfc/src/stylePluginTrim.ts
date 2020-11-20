import { Rule, AtRule } from 'postcss'

const handleTrim = ({ raws }: Rule | AtRule) => {
  if (raws.before) raws.before = '\n'
  if (raws.after) raws.after = '\n'
}

export default () => ({
  postcssPlugin: 'trim',
  Rule: handleTrim,
  AtRule: handleTrim
})

module.exports.postcss = true
