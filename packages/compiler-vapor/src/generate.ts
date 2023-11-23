import {
  CodegenContext,
  CodegenOptions,
  CodegenResult,
} from '@vue/compiler-dom'
import { DynamicChildren, IRNodeTypes, RootIRNode } from './transform'

// IR -> JS codegen
export function generate(
  ir: RootIRNode,
  options: CodegenOptions & {
    onContextCreated?: (context: CodegenContext) => void
  } = {},
): CodegenResult {
  let code = ''
  let preamble = `import { watchEffect } from 'vue'
import { template, setAttr, setText, children, on, insert } from 'vue/vapor'\n`

  const isSetupInlined = !!options.inline

  preamble += ir.template
    .map((template, i) => `const t${i} = template(\`${template.template}\`)\n`)
    .join('')

  code += `const root = t0()\n`

  if (ir.children[0]) {
    code += `const {${genChildrens(
      ir.children[0].children,
    )}} = children(root)\n`
  }

  for (const opration of ir.opration) {
    switch (opration.type) {
      case IRNodeTypes.TEXT_NODE: {
        code += `const n${opration.id} = document.createTextNode(${opration.content})\n`
        break
      }

      case IRNodeTypes.INSERT_NODE:
        {
          let anchor = ''
          if (typeof opration.anchor === 'number') {
            anchor = `, n${opration.anchor}`
          } else if (opration.anchor === 'first') {
            anchor = `, 0 /* InsertPosition.FIRST */`
          }
          code += `insert(n${opration.element}, n${opration.parent}${anchor})\n`
        }
        break
    }
  }

  for (const [expr, effects] of Object.entries(ir.effect)) {
    let scope = `watchEffect(() => {\n`
    for (const effect of effects) {
      switch (effect.type) {
        case IRNodeTypes.SET_PROP:
          scope += `setAttr(n${effect.element}, ${JSON.stringify(
            effect.name,
          )}, undefined, ${expr})\n`
          break
        case IRNodeTypes.SET_TEXT:
          scope += `setText(n${effect.element}, undefined, ${expr})\n`
          break
        case IRNodeTypes.SET_EVENT:
          scope += `on(n${effect.element}, ${JSON.stringify(
            effect.name,
          )}, ${expr})\n`
          break
      }
    }
    scope += '})\n'
    code += scope
  }

  code += 'return root'

  const functionName = options.ssr ? `ssrRender` : `render`
  if (isSetupInlined) {
    code = `(() => {\n${code}\n})();`
  } else {
    code = `${preamble}export function ${functionName}() {\n${code}\n}`
  }

  return {
    code,
    ast: ir as any,
    preamble,
  }
}

function genChildrens(children: DynamicChildren) {
  let str = ''
  for (const [index, child] of Object.entries(children)) {
    str += ` ${index}: [`
    if (child.store) {
      str += `n${child.id}`
    }
    if (Object.keys(child.children).length) {
      str += `, {${genChildrens(child.children)}}`
    }
    str += '],'
  }
  return str
}
