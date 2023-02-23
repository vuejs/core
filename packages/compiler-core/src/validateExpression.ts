import { SimpleExpressionNode } from './ast'
import { TransformContext } from './transform'
import { createCompilerError, ErrorCodes } from './errors'

// these keywords should not appear inside expressions, but operators like
// 'typeof', 'instanceof', and 'in' are allowed
const prohibitedKeywordRE = new RegExp(
  '\\b' +
    (
      'arguments,await,break,case,catch,class,const,continue,debugger,default,' +
      'delete,do,else,export,extends,finally,for,function,if,import,let,new,' +
      'return,super,switch,throw,try,var,void,while,with,yield'
    )
      .split(',')
      .join('\\b|\\b') +
    '\\b'
)

// strip strings in expressions
const stripStringRE =
  /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*\$\{|\}(?:[^`\\]|\\.)*`|`(?:[^`\\]|\\.)*`/g

/**
 * Validate a non-prefixed expression.
 * This is only called when using the in-browser runtime compiler since it
 * doesn't prefix expressions.
 */
export function validateBrowserExpression(
  node: SimpleExpressionNode,
  context: TransformContext,
  asParams = false,
  asRawStatements = false
) {
  const exp = node.content

  // empty expressions are validated per-directive since some directives
  // do allow empty expressions.
  if (!exp.trim()) {
    return
  }

  try {
    new Function(
      asRawStatements
        ? ` ${exp} `
        : `return ${asParams ? `(${exp}) => {}` : `(${exp})`}`
    )
  } catch (e: any) {
    let message = e.message
    const keywordMatch = exp
      .replace(stripStringRE, '')
      .match(prohibitedKeywordRE)
    if (keywordMatch) {
      message = `avoid using JavaScript keyword as property name: "${keywordMatch[0]}"`
    }
    context.onError(
      createCompilerError(
        ErrorCodes.X_INVALID_EXPRESSION,
        node.loc,
        undefined,
        message
      )
    )
  }
}
