import postcss, { Root } from 'postcss'
import selectorParser, { Node, Selector } from 'postcss-selector-parser'

export default postcss.plugin('vue-scoped', (options: any) => (root: Root) => {
  const id: string = options
  const keyframes = Object.create(null)

  root.each(function rewriteSelectors(node) {
    if (node.type !== 'rule') {
      // handle media queries
      if (node.type === 'atrule') {
        if (node.name === 'media' || node.name === 'supports') {
          node.each(rewriteSelectors)
        } else if (/-?keyframes$/.test(node.name)) {
          // register keyframes
          keyframes[node.params] = node.params = node.params + '-' + id
        }
      }
      return
    }

    node.selector = selectorParser(selectors => {
      function rewriteSelector(selector: Selector, slotted?: boolean) {
        let node: Node | null = null
        let shouldInject = true
        // find the last child node to insert attribute selector
        selector.each(n => {
          // DEPRECATED ">>>" and "/deep/" combinator
          if (
            n.type === 'combinator' &&
            (n.value === '>>>' || n.value === '/deep/')
          ) {
            n.value = ' '
            n.spaces.before = n.spaces.after = ''
            console.warn(
              `[@vue/compiler-sfc] the >>> and /deep/ combinators have ` +
                `been deprecated. Use ::v-deep instead.`
            )
            return false
          }

          if (n.type === 'pseudo') {
            // deep: inject [id] attribute at the node before the ::v-deep
            // combinator.
            if (n.value === '::v-deep') {
              if (n.nodes.length) {
                // .foo ::v-deep(.bar) -> .foo[xxxxxxx] .bar
                // replace the current node with ::v-deep's inner selector
                selector.insertAfter(n, n.nodes[0])
                // insert a space combinator before if it doesn't already have one
                const prev = selector.at(selector.index(n) - 1)
                if (!prev || !isSpaceCombinator(prev)) {
                  selector.insertAfter(
                    n,
                    selectorParser.combinator({
                      value: ' '
                    })
                  )
                }
                selector.removeChild(n)
              } else {
                // DEPRECATED usage
                // .foo ::v-deep .bar -> .foo[xxxxxxx] .bar
                console.warn(
                  `[@vue/compiler-sfc] ::v-deep usage as a combinator has ` +
                    `been deprecated. Use ::v-deep(<inner-selector>) instead.`
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
            if (n.value === '::v-slotted') {
              rewriteSelector(n.nodes[0] as Selector, true /* slotted */)
              selector.insertAfter(n, n.nodes[0])
              selector.removeChild(n)
              // since slotted attribute already scopes the selector there's no
              // need for the non-slot attribute.
              shouldInject = false
              return false
            }

            // global: replace with inner selector and do not inject [id].
            // ::v-global(.foo) -> .foo
            if (n.value === '::v-global') {
              selectors.insertAfter(selector, n.nodes[0])
              selectors.removeChild(selector)
              return false
            }
          }

          if (n.type !== 'pseudo' && n.type !== 'combinator') {
            node = n
          }
        })

        if (node) {
          ;(node as Node).spaces.after = ''
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
              quoteMark: `"`
            })
          )
        }
      }
      selectors.each(selector => rewriteSelector(selector as Selector))
    }).processSync(node.selector)
  })

  // If keyframes are found in this <style>, find and rewrite animation names
  // in declarations.
  // Caveat: this only works for keyframes and animation rules in the same
  // <style> element.
  if (Object.keys(keyframes).length) {
    root.walkDecls(decl => {
      // individual animation-name declaration
      if (/^(-\w+-)?animation-name$/.test(decl.prop)) {
        decl.value = decl.value
          .split(',')
          .map(v => keyframes[v.trim()] || v.trim())
          .join(',')
      }
      // shorthand
      if (/^(-\w+-)?animation$/.test(decl.prop)) {
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
})

function isSpaceCombinator(node: Node) {
  return node.type === 'combinator' && /^\s+$/.test(node.value)
}
