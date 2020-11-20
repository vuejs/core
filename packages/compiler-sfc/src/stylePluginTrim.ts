import { Rule, AtRule } from 'postcss'

const handleTrim = ({ raws }: Rule | AtRule) => {
  if (raws.before) raws.before = '\n'
  if (raws.after) raws.after = '\n'
}

const trimPlugin = () => ({
  postcssPlugin: 'trim',
  Rule: handleTrim,
  AtRule: handleTrim
})
trimPlugin.postcss = true

export default trimPlugin
