import {
  type AtRule,
  type Container,
  type Document,
  type PluginCreator,
  Rule,
} from 'postcss'
import selectorParser from 'postcss-selector-parser'
import { warn } from '../warn'

const animationNameRE = /^(?:-\w+-)?animation-name$/
const animationRE = /^(?:-\w+-)?animation$/
const keyframesRE = /^(?:-\w+-)?keyframes$/
const pseudoElementRE = /^(?:::|:(?:before|after|first-line|first-letter)$)/

const scopedPlugin: PluginCreator<string> = (id = '') => {
  const keyframes = Object.create(null)
  const shortId = id.replace(/^data-v-/, '')

  return {
    postcssPlugin: 'vue-sfc-scoped',
    Rule(rule) {
      processRule(id, rule)
    },
    AtRule(node) {
      if (keyframesRE.test(node.name) && !node.params.endsWith(`-${shortId}`)) {
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
    // branch wrappers are generated with their final selector
    (rule as any).__branch ||
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
  if (!deep && splitMixedDeepRuleBody(id, rule)) {
    return
  }
  rule.selector = selectorParser(selectorRoot => {
    selectorRoot.each(selector => {
      rewriteSelector(id, rule, selector, selectorRoot, deep)
    })
  }).processSync(rule.selector)
}

/**
 * Whether the node has nested rules, including ones sitting below at-rules
 * such as `@media`. Keyframes are skipped: their `from` / `to` children are
 * not nested style rules.
 */
function hasNestedRule(node: Rule | AtRule): boolean {
  return !!node.nodes?.some(
    child =>
      child.type === 'rule' ||
      (child.type === 'atrule' &&
        !keyframesRE.test(child.name) &&
        hasNestedRule(child)),
  )
}

/**
 * A selector list can mix `:deep()` members with plain ones, but the rule body
 * is shared by all of them. When the rule also has nested rules, the two kinds
 * need the scope id in different places (`.a > span[id]` vs
 * `.b[id] .c > span`), which a single rule cannot express. Give each kind its
 * own copy of the body, wrapped in `&:where(<members of that kind>)`.
 *
 * The selector list itself is left whole, because per the CSS nesting spec the
 * specificity of `&` is the largest specificity in the parent selector list.
 * Splitting the list into two rules would evaluate each branch against a
 * smaller list and could change which declaration wins the cascade;
 * `&:where()` narrows what a branch matches while adding no specificity of its
 * own, so nested rules keep the weight they have without the split.
 */
function splitMixedDeepRuleBody(id: string, rule: Rule): boolean {
  if (!hasNestedRule(rule)) {
    return false
  }
  const selectorRoot = selectorParser().astSync(rule.selector)
  if (selectorRoot.nodes.length < 2) {
    return false
  }
  const members: { deep: boolean; scoped: string }[] = []
  for (const selector of selectorRoot.nodes) {
    if (
      // a `:global()` member is neither scoped nor deep, so it belongs to
      // neither branch
      selector.some(isGlobalSelector) ||
      // a `:slotted()` member gets its own `-s` attribute handling in
      // rewriteSelector, which the branch wrapper cannot reproduce
      selector.some(isSlottedSelector) ||
      // a member written on `&` refers to the selector list of the rule that
      // contains this one, but inside a branch wrapper it would resolve
      // against the mixed list itself
      hasNestingSelector(selector)
    ) {
      return false
    }
    const scoped = rewriteMemberSelector(id, String(selector).trim())
    if (scoped === null) {
      return false
    }
    members.push({ deep: selector.some(isDeepSelector), scoped })
  }
  const deepMembers = members.filter(member => member.deep)
  if (!deepMembers.length || deepMembers.length === members.length) {
    return false
  }
  const plainMembers = members.filter(member => !member.deep)

  const deepBranch = createBranchRule(rule, deepMembers)
  const plainBranch = createBranchRule(rule, plainMembers)
  // deep mode is carried by the deep branch instead of by the rule holding the
  // mixed list
  ;(deepBranch as any).__deep = true

  rule.selector = members.map(member => member.scoped).join(',\n')
  rule.removeAll()
  rule.append(
    members[0].deep ? [deepBranch, plainBranch] : [plainBranch, deepBranch],
  )

  // mirror what rewriteSelector does for a non-deep rule with nested rules:
  // declarations move into `&` so that they get the scope id
  extractAndWrapNodes(plainBranch)
  for (const node of plainBranch.nodes) {
    if (node.type === 'atrule') {
      extractAndWrapNodes(node)
    }
  }
  return true
}

/**
 * Rewrite one member of a selector list on its own, so that a branch wrapper
 * can select on the final, scoped form of the members it stands for. Returns
 * null for a member that cannot be used inside `:where()`.
 */
function rewriteMemberSelector(id: string, selector: string): string | null {
  // rewriteSelector looks at the rule to decide where the scope id goes, and
  // for a rule with nested rules it goes on those rather than on the member
  // itself - stand in for the rule being processed so that its body, which is
  // about to be moved into the branches, is left alone
  const stub = new Rule({
    selector,
    nodes: [new Rule({ selector: '&', nodes: [] })],
  })
  const scoped = selectorParser(memberRoot => {
    memberRoot.each(memberSelector =>
      rewriteSelector(id, stub, memberSelector, memberRoot, false),
    )
  }).processSync(selector)
  const scopedRoot = selectorParser().astSync(scoped)
  // `:where()` drops any argument it cannot parse, and pseudo elements are not
  // valid there; a member that expanded into several selectors cannot be
  // attributed to a single branch either
  if (scopedRoot.nodes.length > 1 || hasPseudoElement(scopedRoot)) {
    return null
  }
  return scoped
}

function createBranchRule(rule: Rule, members: { scoped: string }[]): Rule {
  const branch = new Rule({
    selector: `&:where(${members.map(member => member.scoped).join(', ')})`,
    nodes: rule.nodes.map(node => node.clone()),
    raws: { before: '\n', between: ' ' },
  })
  // the branch selector is generated in its final form, so processRule must
  // leave it alone
  ;(branch as any).__branch = true
  return branch
}

function hasNestingSelector(selector: selectorParser.Selector): boolean {
  let found = false
  selector.walk(node => {
    if (node.type === 'nesting') {
      found = true
    }
  })
  return found
}

function hasPseudoElement(selectorRoot: selectorParser.Root): boolean {
  let found = false
  selectorRoot.walkPseudos(pseudo => {
    if (pseudoElementRE.test(pseudo.value)) {
      found = true
    }
  })
  return found
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

function isGlobalSelector(node: selectorParser.Node): boolean {
  if (
    node.type === 'pseudo' &&
    (node.value === ':global' || node.value === '::v-global')
  ) {
    return true
  }

  return !!(
    node as selectorParser.Node & { nodes?: selectorParser.Node[] }
  ).nodes?.some(child => isGlobalSelector(child))
}

function isSlottedSelector(node: selectorParser.Node): boolean {
  if (
    node.type === 'pseudo' &&
    (node.value === ':slotted' || node.value === '::v-slotted')
  ) {
    return true
  }

  return !!(
    node as selectorParser.Node & { nodes?: selectorParser.Node[] }
  ).nodes?.some(child => isSlottedSelector(child))
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
