import { type CodeFragment, type CodegenContext, NEWLINE } from '../generate'
import type { TemplateFactoryIRNode } from '../ir'

export function genTemplate(
  node: TemplateFactoryIRNode,
  index: number,
  { vaporHelper }: CodegenContext,
): CodeFragment[] {
  // TODO source map?
  return [
    NEWLINE,
    `const t${index} = ${vaporHelper('template')}(${JSON.stringify(
      node.template,
    )})`,
  ]
}
