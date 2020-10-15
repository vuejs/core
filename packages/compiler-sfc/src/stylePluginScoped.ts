import postcss, { Root } from 'postcss'
import selectorParser, { Node, Selector } from 'postcss-selector-parser'

const animationNameRE = /^(-\w+-)?animation-name$/
const animationRE = /^(-\w+-)?animation$/

export default postcss.plugin('vue-scoped', (id: any) => (root: Root) => {
  const keyframes = Object.create(null)
  const shortId = id.replace(/^data-v-/, '')

  root.each(function rewriteSelectors(node) {
    if (node.type !== 'rule') {
      // handle media queries
      if (node.type === 'atrule') {
        if (node.name === 'media' || node.name === 'supports') {
          node.each(rewriteSelectors)
        } else if (/-?keyframes$/.test(node.name)) {
          // register keyframes
          keyframes[node.params] = node.params = node.params + '-' + shortId
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
            const { value } = n
            // deep: inject [id] attribute at the node before the ::v-deep
            // combinator.
            if (value === ':deep' || value === '::v-deep') {
              if (n.nodes.length) {
                // .foo ::v-deep(.bar) -> .foo[xxxxxxx] .bar
                // replace the current node with ::v-deep's inner selector
                let last: Selector['nodes'][0] = n
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
            if (value === ':slotted' || value === '::v-slotted') {
              rewriteSelector(n.nodes[0], true /* slotted */)
              let last: Selector['nodes'][0] = n
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
      selectors.each(selector => rewriteSelector(selector))
    }).processSync(node.selector)
  })

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
})

function isSpaceCombinator(node: Node) {
  return node.type === 'combinator' && /^\s+$/.test(node.value)
}
