import {
  CodegenContext,
  CodegenOptions,
  CodegenResult
} from '@vue/compiler-dom'
import { RootIRNode } from './transform'

// IR -> JS codegen
export function generate(
  ast: RootIRNode,
  options: CodegenOptions & {
    onContextCreated?: (context: CodegenContext) => void
  } = {}
): CodegenResult {
  let code = ''
  let preamble = "import { template } from 'vue/vapor'\n"

  const isSetupInlined = !!options.inline

  preamble += ast.template
    .map((template, i) => `const t${i} = template(\`${template.template}\`)\n`)
    .join('')

  code += 'const root = t0()\n'
  code += 'return root'

  const functionName = options.ssr ? `ssrRender` : `render`
  if (isSetupInlined) {
    code = `(() => {\n${code}\n})();`
  } else {
    code = `${preamble}export function ${functionName}() {\n${code}\n}`
  }

  return {
    code,
    ast: ast as any,
    preamble
  }
}
