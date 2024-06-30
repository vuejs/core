import {
  type AttributeNode,
  type BindingMetadata,
  type DirectiveNode,
  NodeTypes,
  type SimpleExpressionNode,
  createRoot,
  createSimpleExpression,
  createTransformContext,
  processExpression,
} from '@vue/compiler-core'

export const CE_STYLE_ATTRS_HELPER = `useCEStyleAttrs`

export function genCEStyleAttrs(
  ceStyleAttrs: Array<AttributeNode | DirectiveNode>[],
  bindings: BindingMetadata,
) {
  let code = ''
  for (let i = 0; i < ceStyleAttrs.length; i++) {
    const ceStyleAttr = ceStyleAttrs[i]
    code = `${code}${doGenStyleAttrsCode(ceStyleAttr, bindings)},\n`
  }
  return `_${CE_STYLE_ATTRS_HELPER}(_ctx => ([\n${code}]))`
}

function doGenStyleAttrsCode(
  attrs: Array<AttributeNode | DirectiveNode>,
  bindings: BindingMetadata,
) {
  const attrsExp = genAttrsFromList(attrs)
  const exp = createSimpleExpression(attrsExp, false)
  const context = createTransformContext(createRoot([]), {
    prefixIdentifiers: true,
    inline: true,
    bindingMetadata: bindings.__isScriptSetup === false ? undefined : bindings,
  })
  const transformed = processExpression(exp, context)

  return transformed.type === NodeTypes.SIMPLE_EXPRESSION
    ? transformed.content
    : transformed.children
        .map(c => {
          return typeof c === 'string' ? c : (c as SimpleExpressionNode).content
        })
        .join('')
}

function genAttrsFromList(attrs: Array<AttributeNode | DirectiveNode>) {
  let code = '  {\n'
  let keySet = new Set<string>()
  for (let i = 0; i < attrs.length; i++) {
    const attr = attrs[i]
    if (attr.type === 6) {
      const key = `"${attr.name}"`
      if (keySet.has(key)) continue
      const val = `${
        (attr as AttributeNode).value
          ? (attr as AttributeNode).value?.content
          : 'undefined'
      }`
      code = code + `   ${key}: ${val},\n`
      keySet.add(key)
    } else if (attr.type === 7) {
      const arg = (attr as DirectiveNode).arg! as SimpleExpressionNode
      const key = !arg.isStatic ? `[${arg.content}]` : `"${arg.content}"`
      if (keySet.has(key)) continue
      code =
        code +
        `   ${key}: ${
          ((attr as DirectiveNode).exp! as SimpleExpressionNode).content
        },\n`
      keySet.add(key)
    }
  }
  code = code + ' }'
  return code
}

// TODO unit test

/*
const __sfc__ = {};
import { openBlock as _openBlock, createElementBlock as _createElementBlock, defineCustomElement as _defineCustomElement } from "vue"
function render(_ctx, _cache) {
  return (_openBlock(), _createElementBlock("h1", null, " app "))
}
__sfc__.render = render
__sfc__.__file = "src/App.vue"
export default customElements.define(name, _defineCustomElement(constructor), options);
*/

// :id="{ id: msg3, 'other-attr': msg }"
// id="{ id: msg3, 'other-attr': msg }"
// .id="{ id: msg3, 'other-attr': msg }"
// v-bind:src="msg2s"
// v-bind:[msg]="msg2"
// :[msg]="msg2"
// :xlink:special="msg3"
