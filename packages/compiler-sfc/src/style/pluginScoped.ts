import {
  type AtRule,
  type Container,
  type Document,
  type PluginCreator,
  Rule,
} from 'postcss'
import selectorParser from 'postcss-selector-parser'
import { warn } from '../warn'

const animationNameRE = /^(-\w+-)?animation-name$/
const animationRE = /^(-\w+-)?animation$/

const scopedPlugin: PluginCreator<string> = (id = '') => {
  const keyframes = Object.create(null)
  const shortId = id.replace(/^data-v-/, '')

  return {
    postcssPlugin: 'vue-sfc-scoped',
    Rule(rule) {
      processRule(id, rule)
    },
    AtRule(node) {
      if (
        /-?keyframes$/.test(node.name) &&
        !node.params.endsWith(`-${shortId}`)
      ) {
        // register keyframes
        keyframes[node.params] = node.params = node.params + '-' + shortId
      }
    },
    OnceExit(root) {
      if (Object.keys(keyframes).length) {
        // If keyframes are found in this <style>, find and rewrite animation names
        // in declarations.
        // Caveat: this only works for keyframes and animation rules in the same
        // <style> element.
        // individual animation-name declaration
        root.walkDecls(decl => {
          if (animationNameRE.test(decl.prop)) {
            decl.value = decl.value
              .split(',')
              .map(v => keyframes[v.trim()] || v.trim())
              .join(',')
          }
          // shorthand
          if (animationRE.test(decl.prop)) {
            decl.value = decl.value
              .split(',')
              .map(v => {
                const vals = v.trim().split(/\s+/)
                const i = vals.findIndex(val => keyframes[val])
                if (i !== -1) {
                  vals.splice(i, 1, keyframes[vals[i]])
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

const processedRules = new WeakSet<Rule>()

function processRule(id: string, rule: Rule) {
  if (
    processedRules.has(rule) ||
    (rule.parent &&
      rule.parent.type === 'atrule' &&
      /-?keyframes$/.test((rule.parent as AtRule).name))
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
      (n.type !== 'pseudo' && n.type !== 'combinator') ||
      (n.type === 'pseudo' &&
        (n.value === ':is' || n.value === ':where') &&
        !node)
    ) {
      node = n
    }
  })

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

  if (node) {
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
