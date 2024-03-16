import { isArray } from '@vue/shared'
import type { CodegenContext } from '../generate'
import type { CreateComponentIRNode, IRProp } from '../ir'
import {
  type CodeFragment,
  INDENT_END,
  INDENT_START,
  NEWLINE,
  genCall,
  genMulti,
} from './utils'
import { genExpression } from './expression'
import { genPropKey } from './prop'

export function genCreateComponent(
  oper: CreateComponentIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { vaporHelper } = context

  const tag = oper.resolve
    ? genCall(vaporHelper('resolveComponent'), JSON.stringify(oper.tag))
    : [oper.tag]

  return [
    NEWLINE,
    `const n${oper.id} = `,
    ...genCall(vaporHelper('createComponent'), tag, genProps()),
  ]

  function genProps() {
    const props = oper.props
      .map(props => {
        if (isArray(props)) {
          if (!props.length) return undefined
          return genStaticProps(props)
        } else {
          return ['() => (', ...genExpression(props, context), ')']
        }
      })
      .filter(Boolean)
    if (props.length) {
      return genMulti(['[', ']', ', '], ...props)
    }
  }

  function genStaticProps(props: IRProp[]) {
    return genMulti(
      [
        ['{', INDENT_START, NEWLINE],
        [INDENT_END, NEWLINE, '}'],
        [', ', NEWLINE],
      ],
      ...props.map(prop => {
        return [
          ...genPropKey(prop, context),
          ': () => (',
          ...genExpression(prop.values[0], context),
          ')',
        ]
      }),
    )
  }
}
