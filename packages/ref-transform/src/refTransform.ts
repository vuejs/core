import {
  Node,
  Identifier,
  BlockStatement,
  CallExpression,
  ObjectPattern,
  VariableDeclaration,
  ArrayPattern,
  Program,
  VariableDeclarator
} from '@babel/types'
import MagicString, { SourceMap } from 'magic-string'
import { walk } from 'estree-walker'
import {
  extractIdentifiers,
  isFunctionType,
  isInDestructureAssignment,
  isReferencedIdentifier,
  isStaticProperty,
  walkFunctionParams
} from '@vue/compiler-core'
import { parse, ParserPlugin } from '@babel/parser'
import { babelParserDefaultPlugins, hasOwn } from '@vue/shared'

const TO_VAR_SYMBOL = '$'
const TO_REF_SYMBOL = '$$'
const shorthands = ['ref', 'computed', 'shallowRef']
const transformCheckRE = /[^\w]\$(?:\$|ref|computed|shallowRef)?\s*(\(|\<)/

export function shouldTransform(src: string): boolean {
  return transformCheckRE.test(src)
}

type Scope = Record<string, boolean | 'prop'>

export interface RefTransformOptions {
  filename?: string
  sourceMap?: boolean
  parserPlugins?: ParserPlugin[]
  importHelpersFrom?: string
}

export interface RefTransformResults {
  code: string
  map: SourceMap | null
  rootRefs: string[]
  importedHelpers: string[]
}

export function transform(
  src: string,
  {
    filename,
    sourceMap,
    parserPlugins,
    importHelpersFrom = 'vue'
  }: RefTransformOptions = {}
): RefTransformResults {
  const plugins: ParserPlugin[] = parserPlugins || []
  if (filename) {
    if (/\.tsx?$/.test(filename)) {
      plugins.push('typescript')
    }
    if (filename.endsWith('x')) {
      plugins.push('jsx')
    }
  }

  const ast = parse(src, {
    sourceType: 'module',
    plugins: [...new Set([...babelParserDefaultPlugins, ...plugins])]
  })
  const s = new MagicString(src)
  const res = transformAST(ast.program, s)

  // inject helper imports
  if (res.importedHelpers.length) {
    s.prepend(
      `import { ${res.importedHelpers
        .map(h => `${h} as _${h}`)
        .join(', ')} } from '${importHelpersFrom}'\n`
    )
  }

  return {
    ...res,
    code: s.toString(),
    map: sourceMap
      ? s.generateMap({
          source: filename,
          hires: true,
          includeContent: true
        })
      : null
  }
}

export function transformAST(
  ast: Program,
  s: MagicString,
  offset = 0,
  knownRefs?: string[],
  knownProps?: Record<
    string, // public prop key
    {
      local: string // local identifier, may be different
      default?: any
    }
  >,
  rewritePropsOnly = false
): {
  rootRefs: string[]
  importedHelpers: string[]
} {
  // TODO remove when out of experimental
  if (!rewritePropsOnly) {
    warnExperimental()
  }

  const importedHelpers = new Set<string>()
  const rootScope: Scope = {}
  const scopeStack: Scope[] = [rootScope]
  let currentScope: Scope = rootScope
  const excludedIds = new WeakSet<Identifier>()
  const parentStack: Node[] = []
  const propsLocalToPublicMap = Object.create(null)

  if (knownRefs) {
    for (const key of knownRefs) {
      rootScope[key] = true
    }
  }
  if (knownProps) {
    for (const key in knownProps) {
      const { local } = knownProps[key]
      rootScope[local] = 'prop'
      propsLocalToPublicMap[local] = key
    }
  }

  function error(msg: string, node: Node) {
    if (rewritePropsOnly) return
    const e = new Error(msg)
    ;(e as any).node = node
    throw e
  }

  function helper(msg: string) {
    importedHelpers.add(msg)
    return `_${msg}`
  }

  function registerBinding(id: Identifier, isRef = false) {
    excludedIds.add(id)
    if (currentScope) {
      currentScope[id.name] = isRef
    } else {
      error(
        'registerBinding called without active scope, something is wrong.',
        id
      )
    }
  }

  const registerRefBinding = (id: Identifier) => registerBinding(id, true)

  function walkScope(node: Program | BlockStatement, isRoot = false) {
    for (const stmt of node.body) {
      if (stmt.type === 'VariableDeclaration') {
        if (stmt.declare) continue
        for (const decl of stmt.declarations) {
          let toVarCall
          const isCall =
            decl.init &&
            decl.init.type === 'CallExpression' &&
            decl.init.callee.type === 'Identifier'
          if (
            isCall &&
            (toVarCall = isToVarCall((decl as any).init.callee.name))
          ) {
            processRefDeclaration(
              toVarCall,
              decl.init as CallExpression,
              decl.id,
              stmt
            )
          } else {
            const isProps =
              isRoot &&
              isCall &&
              (decl as any).init.callee.name === 'defineProps'
            for (const id of extractIdentifiers(decl.id)) {
              if (isProps) {
                // for defineProps destructure, only exclude them since they
                // are already passed in as knownProps
                excludedIds.add(id)
              } else {
                registerBinding(id)
              }
            }
          }
        }
      } else if (
        stmt.type === 'FunctionDeclaration' ||
        stmt.type === 'ClassDeclaration'
      ) {
        if (stmt.declare || !stmt.id) continue
        registerBinding(stmt.id)
      }
    }
  }

  function processRefDeclaration(
    method: string,
    call: CallExpression,
    id: VariableDeclarator['id'],
    statement: VariableDeclaration
  ) {
    excludedIds.add(call.callee as Identifier)
    if (statement.kind !== 'let') {
      error(`${method}() bindings can only be declared with let`, call)
    }
    if (method === TO_VAR_SYMBOL) {
      // $
      // remove macro
      s.remove(call.callee.start! + offset, call.callee.end! + offset)
      if (id.type === 'Identifier') {
        // single variable
        registerRefBinding(id)
      } else if (id.type === 'ObjectPattern') {
        processRefObjectPattern(id, statement)
      } else if (id.type === 'ArrayPattern') {
        processRefArrayPattern(id, statement)
      }
    } else {
      // shorthands
      if (id.type === 'Identifier') {
        registerRefBinding(id)
        // replace call
        s.overwrite(
          call.start! + offset,
          call.start! + method.length + offset,
          helper(method.slice(1))
        )
      } else {
        error(`${method}() cannot be used with destructure patterns.`, call)
      }
    }
  }

  function processRefObjectPattern(
    pattern: ObjectPattern,
    statement: VariableDeclaration
  ) {
    for (const p of pattern.properties) {
      let nameId: Identifier | undefined
      if (p.type === 'ObjectProperty') {
        if (p.key.start! === p.value.start!) {
          // shorthand { foo } --> { foo: __foo }
          nameId = p.key as Identifier
          s.appendLeft(nameId.end! + offset, `: __${nameId.name}`)
          if (p.value.type === 'Identifier') {
            // avoid shorthand value identifier from being processed
            excludedIds.add(p.value)
          } else if (
            p.value.type === 'AssignmentPattern' &&
            p.value.left.type === 'Identifier'
          ) {
            // { foo = 1 }
            excludedIds.add(p.value.left)
          }
        } else {
          if (p.value.type === 'Identifier') {
            // { foo: bar } --> { foo: __bar }
            nameId = p.value
            s.prependRight(nameId.start! + offset, `__`)
          } else if (p.value.type === 'ObjectPattern') {
            processRefObjectPattern(p.value, statement)
          } else if (p.value.type === 'ArrayPattern') {
            processRefArrayPattern(p.value, statement)
          } else if (p.value.type === 'AssignmentPattern') {
            // { foo: bar = 1 } --> { foo: __bar = 1 }
            nameId = p.value.left as Identifier
            s.prependRight(nameId.start! + offset, `__`)
          }
        }
      } else {
        // rest element { ...foo } --> { ...__foo }
        nameId = p.argument as Identifier
        s.prependRight(nameId.start! + offset, `__`)
      }
      if (nameId) {
        registerRefBinding(nameId)
        // append binding declarations after the parent statement
        s.appendLeft(
          statement.end! + offset,
          `\nconst ${nameId.name} = ${helper('shallowRef')}(__${nameId.name});`
        )
      }
    }
  }

  function processRefArrayPattern(
    pattern: ArrayPattern,
    statement: VariableDeclaration
  ) {
    for (const e of pattern.elements) {
      if (!e) continue
      let nameId: Identifier | undefined
      if (e.type === 'Identifier') {
        // [a] --> [__a]
        nameId = e
      } else if (e.type === 'AssignmentPattern') {
        // [a = 1] --> [__a = 1]
        nameId = e.left as Identifier
      } else if (e.type === 'RestElement') {
        // [...a] --> [...__a]
        nameId = e.argument as Identifier
      } else if (e.type === 'ObjectPattern') {
        processRefObjectPattern(e, statement)
      } else if (e.type === 'ArrayPattern') {
        processRefArrayPattern(e, statement)
      }
      if (nameId) {
        registerRefBinding(nameId)
        // prefix original
        s.prependRight(nameId.start! + offset, `__`)
        // append binding declarations after the parent statement
        s.appendLeft(
          statement.end! + offset,
          `\nconst ${nameId.name} = ${helper('shallowRef')}(__${nameId.name});`
        )
      }
    }
  }

  function rewriteId(
    scope: Scope,
    id: Identifier,
    parent: Node,
    parentStack: Node[]
  ): boolean {
    if (hasOwn(scope, id.name)) {
      const bindingType = scope[id.name]
      if (bindingType) {
        const isProp = bindingType === 'prop'
        if (rewritePropsOnly && !isProp) {
          return true
        }
        // ref
        if (isStaticProperty(parent) && parent.shorthand) {
          // let binding used in a property shorthand
          // { foo } -> { foo: foo.value }
          // { prop } -> { prop: __prop.prop }
          // skip for destructure patterns
          if (
            !(parent as any).inPattern ||
            isInDestructureAssignment(parent, parentStack)
          ) {
            if (isProp) {
              s.appendLeft(
                id.end! + offset,
                `: __props.${propsLocalToPublicMap[id.name]}`
              )
            } else {
              s.appendLeft(id.end! + offset, `: ${id.name}.value`)
            }
          }
        } else {
          if (isProp) {
            s.overwrite(
              id.start! + offset,
              id.end! + offset,
              `__props.${propsLocalToPublicMap[id.name]}`
            )
          } else {
            s.appendLeft(id.end! + offset, '.value')
          }
        }
      }
      return true
    }
    return false
  }

  // check root scope first
  walkScope(ast, true)
  ;(walk as any)(ast, {
    enter(node: Node, parent?: Node) {
      parent && parentStack.push(parent)

      // function scopes
      if (isFunctionType(node)) {
        scopeStack.push((currentScope = {}))
        walkFunctionParams(node, registerBinding)
        if (node.body.type === 'BlockStatement') {
          walkScope(node.body)
        }
        return
      }

      // non-function block scopes
      if (node.type === 'BlockStatement' && !isFunctionType(parent!)) {
        scopeStack.push((currentScope = {}))
        walkScope(node)
        return
      }

      if (
        parent &&
        parent.type.startsWith('TS') &&
        parent.type !== 'TSAsExpression' &&
        parent.type !== 'TSNonNullExpression' &&
        parent.type !== 'TSTypeAssertion'
      ) {
        return this.skip()
      }

      if (
        node.type === 'Identifier' &&
        isReferencedIdentifier(node, parent!, parentStack) &&
        !excludedIds.has(node)
      ) {
        // walk up the scope chain to check if id should be appended .value
        let i = scopeStack.length
        while (i--) {
          if (rewriteId(scopeStack[i], node, parent!, parentStack)) {
            return
          }
        }
      }

      if (node.type === 'CallExpression' && node.callee.type === 'Identifier') {
        const callee = node.callee.name

        const toVarCall = isToVarCall(callee)
        if (toVarCall && (!parent || parent.type !== 'VariableDeclarator')) {
          return error(
            `${toVarCall} can only be used as the initializer of ` +
              `a variable declaration.`,
            node
          )
        }

        if (callee === TO_REF_SYMBOL) {
          s.remove(node.callee.start! + offset, node.callee.end! + offset)
          return this.skip()
        }

        // TODO remove when out of experimental
        if (callee === '$raw') {
          error(
            `$raw() has been replaced by $$(). ` +
              `See ${RFC_LINK} for latest updates.`,
            node
          )
        }
        if (callee === '$fromRef') {
          error(
            `$fromRef() has been replaced by $(). ` +
              `See ${RFC_LINK} for latest updates.`,
            node
          )
        }
      }
    },
    leave(node: Node, parent?: Node) {
      parent && parentStack.pop()
      if (
        (node.type === 'BlockStatement' && !isFunctionType(parent!)) ||
        isFunctionType(node)
      ) {
        scopeStack.pop()
        currentScope = scopeStack[scopeStack.length - 1] || null
      }
    }
  })

  return {
    rootRefs: Object.keys(rootScope).filter(key => rootScope[key] === true),
    importedHelpers: [...importedHelpers]
  }
}

function isToVarCall(callee: string): string | false {
  if (callee === TO_VAR_SYMBOL) {
    return TO_VAR_SYMBOL
  }
  if (callee[0] === TO_VAR_SYMBOL && shorthands.includes(callee.slice(1))) {
    return callee
  }
  return false
}

const RFC_LINK = `https://github.com/vuejs/rfcs/discussions/369`
const hasWarned: Record<string, boolean> = {}

function warnExperimental() {
  // eslint-disable-next-line
  if (typeof window !== 'undefined') {
    return
  }
  warnOnce(
    `@vue/ref-transform is an experimental feature.\n` +
      `Experimental features may change behavior between patch versions.\n` +
      `It is recommended to pin your vue dependencies to exact versions to avoid breakage.\n` +
      `You can follow the proposal's status at ${RFC_LINK}.`
  )
}

function warnOnce(msg: string) {
  const isNodeProd =
    typeof process !== 'undefined' && process.env.NODE_ENV === 'production'
  if (!isNodeProd && !__TEST__ && !hasWarned[msg]) {
    hasWarned[msg] = true
    warn(msg)
  }
}

function warn(msg: string) {
  console.warn(
    `\x1b[1m\x1b[33m[@vue/ref-transform]\x1b[0m\x1b[33m ${msg}\x1b[0m\n`
  )
}
