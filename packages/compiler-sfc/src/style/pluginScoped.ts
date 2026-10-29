import {
  type AtRule,
  type Container,
  type Document,
  type PluginCreator,
  Rule,
  list,
} from 'postcss'
import selectorParser from 'postcss-selector-parser'
import { warn } from '../warn'

const animationNameRE = /^(?:-\w+-)?animation-name$/
const animationRE = /^(?:-\w+-)?animation$/
const keyframesRE = /^(?:-\w+-)?keyframes$/
const animationFields = [
  /^(?:linear|ease|ease-in|ease-out|ease-in-out|step-start|step-end)$/i,
  /^infinite$/i,
  /^(?:normal|reverse|alternate|alternate-reverse)$/i,
  /^(?:none|forwards|backwards|both)$/i,
  /^(?:running|paused)$/i,
]
const animationNumberRE = /^[+-]?(?:\d*\.)?\d+(?:e[+-]?\d+)?$/i
const animationTimeRE = /^[+-]?(?:\d*\.)?\d+(?:e[+-]?\d+)?m?s$/i
const animationTimingFunctionRE = /^(?:cubic-bezier|steps|linear)\(/i

const scopedPlugin: PluginCreator<string> = (id = '') => {
  const keyframes = new Set<string>()
  const shortId = id.replace(/^data-v-/, '')

  return {
    postcssPlugin: 'vue-sfc-scoped',
    Rule(rule) {
      processRule(id, rule)
    },
    AtRule(node) {
      if (keyframesRE.test(node.name)) {
        const name = getKeyframeName(node.params)
        if (name && !name.endsWith(`-${shortId}`)) {
          keyframes.add(name)
          node.params = scopeKeyframeName(node.params, shortId)
        }
      }
    },
    OnceExit(root) {
      if (keyframes.size) {
        // If keyframes are found in this <style>, find and rewrite animation names
        // in declarations.
        // Caveat: this only works for keyframes and animation rules in the same
        // <style> element.
        // individual animation-name declaration
        root.walkDecls(decl => {
          if (animationNameRE.test(decl.prop)) {
            decl.value = list
              .comma(decl.value)
              .map(v =>
                keyframes.has(getKeyframeName(v))
                  ? scopeKeyframeName(v, shortId)
                  : v,
              )
              .join(',')
          }
          // shorthand
          if (animationRE.test(decl.prop)) {
            decl.value = list
              .comma(decl.value)
              .map(v => {
                const vals = splitAnimationValues(v)
                const i = findAnimationName(vals)
                if (i !== -1 && keyframes.has(getKeyframeName(vals[i]))) {
                  vals[i] = scopeKeyframeName(vals[i], shortId)
                  return vals.join(' ')
                } else {
                  return v
                }
              })
              .join(',')
          }
        })
      }
    },
  }
}

function splitAnimationValues(value: string): string[] {
  const values: string[] = []
  const escapeRE = /\\(?:[\da-f]{1,6}(?:\r\n|[\t\n\f\r ])?|[\s\S])/iy
  let start = 0
  let quote = ''
  let depth = 0
  for (let i = 0; i < value.length; i++) {
    const char = value[i]
    if (char === '\\') {
      // Hex escapes can include whitespace that belongs to the same token.
      escapeRE.lastIndex = i
      if (escapeRE.test(value)) i = escapeRE.lastIndex - 1
      continue
    }
    if (quote) {
      if (char === quote) quote = ''
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
    } else if (char === '/' && value[i + 1] === '*') {
      const end = value.indexOf('*/', i + 2)
      if (!depth && start < i) values.push(value.slice(start, i))
      i = end < 0 ? value.length - 1 : end + 1
      if (!depth) start = i + 1
    } else if (char === '(') {
      depth++
    } else if (char === ')') {
      if (depth) depth--
    } else if (!depth && /[\t\n\f\r ]/.test(char)) {
      if (start < i) values.push(value.slice(start, i))
      start = i + 1
    }
  }
  if (start < value.length) values.push(value.slice(start))
  return values
}

function findAnimationName(values: string[]): number {
  const seen = new Set<number>()
  let durationAvailable = true
  for (let i = 0; i < values.length; i++) {
    const value = values[i]
    if (value[0] === '"' || value[0] === "'") {
      return i
    }
    const identifier = isCssIdentifier(value)
    const decoded = unescapeCss(value)
    if (identifier && /^auto$/i.test(decoded) && durationAvailable) {
      durationAvailable = false
      continue
    }
    const field = identifier
      ? animationFields.findIndex(re => re.test(decoded))
      : animationNumberRE.test(value)
        ? 1
        : animationTimingFunctionRE.test(decoded)
          ? 0
          : -1
    // Negative literal times are delays. Other times occupy the duration;
    // preserve possible names after functions with an unresolved result type.
    if (
      !identifier &&
      field === -1 &&
      (animationTimeRE.test(value)
        ? parseFloat(value) >= 0
        : value.includes('('))
    ) {
      durationAvailable = false
    }
    // Keywords belong to an unset shorthand field before they can be names.
    // A later keyword for an already populated field can be the animation name.
    if (field !== -1 && !seen.has(field)) {
      seen.add(field)
      continue
    }
    if (identifier) {
      return i
    }
  }
  return -1
}

function getKeyframeName(value: string): string {
  const quoted = value[0] === '"' || value[0] === "'"
  // A string can name a keyframe without being a valid unquoted identifier.
  // In particular, do not mistake functions such as var() for those names.
  if (!quoted && !isCssIdentifier(value)) {
    return ''
  }
  const name = unescapeCss(quoted ? value.slice(1, -1) : value)
  return !quoted &&
    /^(?:none|default|initial|inherit|unset|revert|revert-layer)$/i.test(name)
    ? ''
    : name
}

function isCssIdentifier(value: string): boolean {
  const identifier = value.replace(
    /\\(?:[\da-f]{1,6}(?:\r\n|[\t\n\f\r ])?|[^\n\f\r])/gi,
    'a',
  )
  return /^(?:--|-?[_a-z\u0080-\uffff])[-\w\u0080-\uffff]*$/i.test(identifier)
}

function scopeKeyframeName(value: string, shortId: string): string {
  return value[0] === '"' || value[0] === "'"
    ? `${value.slice(0, -1)}-${shortId}${value[0]}`
    : `${value}-${shortId}`
}

function unescapeCss(value: string): string {
  return value.replace(
    /\\(?:([\da-f]{1,6})(?:\r\n|[\t\n\f\r ])?|(\r\n|[\n\f\r])|(.))/gi,
    (_, hex: string | undefined, newline: string | undefined, char: string) => {
      if (hex) {
        const code = parseInt(hex, 16)
        return code === 0 ||
          code > 0x10ffff ||
          (code >= 0xd800 && code <= 0xdfff)
          ? '\ufffd'
          : String.fromCodePoint(code)
      }
      return newline ? '' : char
    },
  )
}

const processedRules = new WeakSet<Rule>()

function processRule(id: string, rule: Rule) {
  if (
    processedRules.has(rule) ||
    (rule.parent &&
      rule.parent.type === 'atrule' &&
      keyframesRE.test((rule.parent as AtRule).name))
  ) {
    return
  }
  processedRules.add(rule)
  let deep = false
  let parent: Document | Container | undefined = rule.parent
  while (parent && parent.type !== 'root') {
    if ((parent as any).__deep) {
      deep = true
      break
    }
    parent = parent.parent
  }
  rule.selector = selectorParser(selectorRoot => {
    selectorRoot.each(selector => {
      rewriteSelector(id, rule, selector, selectorRoot, deep)
    })
  }).processSync(rule.selector)
}

function rewriteSelector(
  id: string,
  rule: Rule,
  selector: selectorParser.Selector,
  selectorRoot: selectorParser.Root,
  deep: boolean,
  slotted = false,
) {
  let node: selectorParser.Node | null = null
  let shouldInject = !deep
  let hasNestedDeep = false
  let splitForNestedDeep = false
  // find the last child node to insert attribute selector
  selector.each(n => {
    // DEPRECATED ">>>" and "/deep/" combinator
    if (
      n.type === 'combinator' &&
      (n.value === '>>>' || n.value === '/deep/')
    ) {
      n.value = ' '
      n.spaces.before = n.spaces.after = ''
      warn(
        `the >>> and /deep/ combinators have been deprecated. ` +
          `Use :deep() instead.`,
      )
      return false
    }

    if (n.type === 'pseudo') {
      const { value } = n
      if (isDeepContainerPseudo(n)) {
        const hasDeepSelectors = n.nodes.some(selector =>
          selector.some(isDeepSelector),
        )
        if (hasDeepSelectors) {
          const hasScopeAnchor = !!node
          const hasMixedSelectors = n.nodes.some(
            selector => !selector.some(isDeepSelector),
          )
          const hasTrailingNodes = selector.index(n) < selector.length - 1
          if (
            canSplitDeepContainerPseudo(n) &&
            !deep &&
            !hasScopeAnchor &&
            hasMixedSelectors &&
            hasTrailingNodes
          ) {
            splitSelectorForNestedDeep(
              id,
              rule,
              selector,
              selectorRoot,
              n,
              deep,
              slotted,
            )
            splitForNestedDeep = true
            return false
          }

          if (
            value === ':not' &&
            !deep &&
            !hasScopeAnchor &&
            hasMixedSelectors &&
            hasTrailingNodes
          ) {
            return
          }

          n.nodes.forEach(selector =>
            rewriteSelector(
              id,
              rule,
              selector,
              selectorRoot,
              deep || hasScopeAnchor,
              slotted,
            ),
          )
          if (!hasScopeAnchor) {
            node = n
            shouldInject = false
          }
          hasNestedDeep = true
        }
      }

      // deep: inject [id] attribute at the node before the ::v-deep
      // combinator.
      if (value === ':deep' || value === '::v-deep') {
        ;(rule as any).__deep = true
        if (n.nodes.length) {
          // .foo ::v-deep(.bar) -> .foo[xxxxxxx] .bar
          // replace the current node with ::v-deep's inner selector
          let last: selectorParser.Selector['nodes'][0] = n
          n.nodes[0].each(ss => {
            selector.insertAfter(last, ss)
            last = ss
          })
          // insert a space combinator before if it doesn't already have one
          const prev = selector.at(selector.index(n) - 1)
          if (!prev || !isSpaceCombinator(prev)) {
            selector.insertAfter(
              n,
              selectorParser.combinator({
                value: ' ',
              }),
            )
          }
          selector.removeChild(n)
        } else {
          // DEPRECATED usage
          // .foo ::v-deep .bar -> .foo[xxxxxxx] .bar
          warn(
            `${value} usage as a combinator has been deprecated. ` +
              `Use :deep(<inner-selector>) instead of ${value} <inner-selector>.`,
          )

          const prev = selector.at(selector.index(n) - 1)
          if (prev && isSpaceCombinator(prev)) {
            selector.removeChild(prev)
          }
          selector.removeChild(n)
        }
        return false
      }

      // slot: use selector inside `::v-slotted` and inject [id + '-s']
      // instead.
      // ::v-slotted(.foo) -> .foo[xxxxxxx-s]
      if (value === ':slotted' || value === '::v-slotted') {
        rewriteSelector(
          id,
          rule,
          n.nodes[0],
          selectorRoot,
          deep,
          true /* slotted */,
        )
        let last: selectorParser.Selector['nodes'][0] = n
        n.nodes[0].each(ss => {
          selector.insertAfter(last, ss)
          last = ss
        })
        // selector.insertAfter(n, n.nodes[0])
        selector.removeChild(n)
        // since slotted attribute already scopes the selector there's no
        // need for the non-slot attribute.
        shouldInject = false
        return false
      }

      // global: replace with inner selector and do not inject [id].
      // ::v-global(.foo) -> .foo
      if (value === ':global' || value === '::v-global') {
        selector.replaceWith(n.nodes[0])
        return false
      }
    }

    if (n.type === 'universal') {
      const prev = selector.at(selector.index(n) - 1)
      const next = selector.at(selector.index(n) + 1)
      // * ... {}
      if (!prev) {
        // * .foo {} -> .foo[xxxxxxx] {}
        if (next) {
          if (next.type === 'combinator' && next.value === ' ') {
            selector.removeChild(next)
          }
          selector.removeChild(n)
          return
        } else {
          // * {} -> [xxxxxxx] {}
          node = selectorParser.combinator({
            value: '',
          })
          selector.insertBefore(n, node)
          selector.removeChild(n)
          return false
        }
      }
      // .foo * -> .foo[xxxxxxx] *
      if (node) return
    }

    if (
      !hasNestedDeep &&
      ((n.type !== 'pseudo' && n.type !== 'combinator') ||
        (n.type === 'pseudo' &&
          (n.value === ':is' || n.value === ':where') &&
          !node))
    ) {
      node = n
    }
  })

  if (splitForNestedDeep) {
    return
  }

  if (rule.nodes.some(node => node.type === 'rule')) {
    const deep = (rule as any).__deep
    if (!deep) {
      extractAndWrapNodes(rule)
      const atruleNodes = rule.nodes.filter(node => node.type === 'atrule')
      for (const atnode of atruleNodes) {
        extractAndWrapNodes(atnode)
      }
    }
    shouldInject = deep
  }

  if (node && !hasNestedDeep) {
    const { type, value } = node as selectorParser.Node
    if (type === 'pseudo' && (value === ':is' || value === ':where')) {
      ;(node as selectorParser.Pseudo).nodes.forEach(value =>
        rewriteSelector(id, rule, value, selectorRoot, deep, slotted),
      )
      shouldInject = false
    }
  }

  if (node) {
    ;(node as selectorParser.Node).spaces.after = ''
  } else {
    // For deep selectors & standalone pseudo selectors,
    // the attribute selectors are prepended rather than appended.
    // So all leading spaces must be eliminated to avoid problems.
    selector.first.spaces.before = ''
  }

  if (shouldInject) {
    const idToAdd = slotted ? id + '-s' : id
    selector.insertAfter(
      // If node is null it means we need to inject [id] at the start
      // insertAfter can handle `null` here
      node as any,
      selectorParser.attribute({
        attribute: idToAdd,
        value: idToAdd,
        raws: {},
        quoteMark: `"`,
      }),
    )
  }
}

function isSpaceCombinator(node: selectorParser.Node) {
  return node.type === 'combinator' && /^\s+$/.test(node.value)
}

function isDeepSelector(node: selectorParser.Node): boolean {
  if (
    node.type === 'pseudo' &&
    (node.value === ':deep' || node.value === '::v-deep')
  ) {
    return true
  }

  return !!(
    node as selectorParser.Node & { nodes?: selectorParser.Node[] }
  ).nodes?.some(child => isDeepSelector(child))
}

function isDeepContainerPseudo(
  node: selectorParser.Node,
): node is selectorParser.Pseudo {
  return (
    node.type === 'pseudo' &&
    (node.value === ':is' ||
      node.value === ':where' ||
      node.value === ':has' ||
      node.value === ':not')
  )
}

function canSplitDeepContainerPseudo(node: selectorParser.Pseudo): boolean {
  return (
    node.value === ':is' || node.value === ':where' || node.value === ':has'
  )
}

function splitSelectorForNestedDeep(
  id: string,
  rule: Rule,
  selector: selectorParser.Selector,
  selectorRoot: selectorParser.Root,
  pseudo: selectorParser.Pseudo,
  deep: boolean,
  slotted: boolean,
) {
  const pseudoIndex = selector.index(pseudo)
  const selectors = pseudo.nodes.map((branch, index) => {
    const branchSelector = selector.clone()
    if (branchSelector.first) {
      branchSelector.first.spaces.before =
        index === 0 ? selector.first.spaces.before : ' '
    }
    const branchPseudo = branchSelector.at(pseudoIndex) as selectorParser.Pseudo
    const branchClone = branch.clone()
    if (branchClone.first) {
      branchClone.first.spaces.before = ''
    }
    branchPseudo.removeAll()
    branchPseudo.append(branchClone)
    rewriteSelector(id, rule, branchSelector, selectorRoot, deep, slotted)
    return branchSelector
  })

  selector.replaceWith(...selectors)
}

function extractAndWrapNodes(parentNode: Rule | AtRule) {
  if (!parentNode.nodes) return
  const nodes = parentNode.nodes.filter(
    node => node.type === 'decl' || node.type === 'comment',
  )
  if (nodes.length) {
    for (const node of nodes) {
      parentNode.removeChild(node)
    }
    const wrappedRule = new Rule({
      nodes: nodes,
      selector: '&',
    })
    parentNode.prepend(wrappedRule)
  }
}

scopedPlugin.postcss = true
export default scopedPlugin
