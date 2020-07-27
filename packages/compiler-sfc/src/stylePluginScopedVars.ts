import postcss, { Root } from 'postcss'

const cssVarRE = /\bvar\(--(global:)?([^)]+)\)/g

export default postcss.plugin('vue-scoped', (id: any) => (root: Root) => {
  const shortId = id.replace(/^data-v-/, '')
  root.walkDecls(decl => {
    // rewrite CSS variables
    if (cssVarRE.test(decl.value)) {
      decl.value = decl.value.replace(cssVarRE, (_, $1, $2) => {
        return $1 ? `var(--${$2})` : `var(--${shortId}-${$2})`
      })
    }
  })
})
