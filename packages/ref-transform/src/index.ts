import {
  Node,
  Identifier,
  BlockStatement,
  CallExpression,
  ObjectPattern,
  VariableDeclaration,
  ArrayPattern
} from '@babel/types'
import MagicString, { SourceMap } from 'magic-string'
import { walk } from 'estree-walker'
import {
  isFunctionType,
  isInDestructureAssignment,
  isStaticProperty,
  walkBlockDeclarations,
  walkFunctionParams,
  walkIdentifiers
} from '@vue/compiler-core'
import { parse, ParserPlugin } from '@babel/parser'
import { babelParserDefaultPlugins } from '@vue/shared'

const TO_VAR_SYMBOL = '$'
const TO_REF_SYMBOL = '$$'
const shorthands = ['ref', 'computed', 'shallowRef']
const transformCheckRE = /[^\w]\$(?:\$|ref|computed|shallowRef)?\(/

export function shouldTransform(src: string): boolean {
  return transformCheckRE.test(src)
}

type Scope = Record<string, boolean>

export interface RefTransformOptions {
  filename?: string
  sourceMap?: boolean
  parserPlugins?: ParserPlugin[]
  importHelpersFrom?: string
}

export interface RefTransformResults {
  code: string
  map: SourceMap | null
  rootVars: string[]
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
  const res = transformAST(ast, s)

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
  ast: Node,
  s: MagicString,
  offset = 0,
  knownRootVars?: string[]
): {
  rootVars: string[]
  importedHelpers: string[]
} {
  const importedHelpers = new Set<string>()
  const blockStack: BlockStatement[] = []
  let currentBlock: BlockStatement | null = null
  const rootScope: Scope = {}
  const blockToScopeMap = new WeakMap<BlockStatement, Scope>()
  const excludedIds = new Set<Identifier>()
  const parentStack: Node[] = []

  if (knownRootVars) {
    for (const key of knownRootVars) {
      rootScope[key] = true
    }
  }

  const error = (msg: string, node: Node) => {
    const e = new Error(msg)
    ;(e as any).node = node
    throw e
  }

  const helper = (msg: string) => {
    importedHelpers.add(msg)
    return `_${msg}`
  }

  const registerBinding = (id: Identifier, isRef = false) => {
    excludedIds.add(id)
    if (currentBlock) {
      const currentScope = blockToScopeMap.get(currentBlock)
      if (!currentScope) {
        blockToScopeMap.set(currentBlock, { [id.name]: isRef })
      } else {
        currentScope[id.name] = isRef
      }
    } else {
      rootScope[id.name] = isRef
    }
  }

  const registerRefBinding = (id: Identifier) => registerBinding(id, true)

  if (ast.type === 'Program') {
    walkBlockDeclarations(ast, registerBinding)
  }

  // 1st pass: detect macro callsites and register ref bindings
  ;(walk as any)(ast, {
    enter(node: Node, parent?: Node) {
      parent && parentStack.push(parent)
      if (node.type === 'BlockStatement') {
        blockStack.push((currentBlock = node))
        walkBlockDeclarations(node, registerBinding)
        if (parent && isFunctionType(parent)) {
          walkFunctionParams(parent, registerBinding)
        }
        return
      }

      const toVarCall = isToVarCall(node)
      if (toVarCall) {
        if (!parent || parent.type !== 'VariableDeclarator') {
          return error(
            `${toVarCall} can only be used as the initializer of ` +
              `a variable declaration.`,
            node
          )
        }
        excludedIds.add((node as CallExpression).callee as Identifier)

        const decl = parentStack[parentStack.length - 2] as VariableDeclaration
        if (decl.kind !== 'let') {
          error(`${toVarCall}() bindings can only be declared with let`, node)
        }

        if (toVarCall === TO_VAR_SYMBOL) {
          // $
          // remove macro
          s.remove(
            (node as CallExpression).callee.start! + offset,
            (node as CallExpression).callee.end! + offset
          )
          if (parent.id.type === 'Identifier') {
            // single variable
            registerRefBinding(parent.id)
          } else if (parent.id.type === 'ObjectPattern') {
            processRefObjectPattern(parent.id, decl)
          } else if (parent.id.type === 'ArrayPattern') {
            processRefArrayPattern(parent.id, decl)
          }
        } else {
          // shorthands
          if (parent.id.type === 'Identifier') {
            registerRefBinding(parent.id)
            // replace call
            s.overwrite(
              node.start! + offset,
              node.start! + toVarCall.length + offset,
              helper(toVarCall.slice(1))
            )
          } else {
            error(
              `${toVarCall}() cannot be used with destructure patterns.`,
              node
            )
          }
        }
      }
    },
    leave(node: Node, parent?: Node) {
      parent && parentStack.pop()
      if (node.type === 'BlockStatement') {
        blockStack.pop()
        currentBlock = blockStack[blockStack.length - 1] || null
      }
    }
  })

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
          if (p.value.type === 'AssignmentPattern') {
            // { foo = 1 }
            registerRefBinding(p.value.left as Identifier)
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
          `\nconst ${nameId.name} = ${helper('ref')}(__${nameId.name});`
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
          `\nconst ${nameId.name} = ${helper('ref')}(__${nameId.name});`
        )
      }
    }
  }

  // 2nd pass: detect references to ref bindings and append .value
  // also remove $$ calls
  walkIdentifiers(
    ast,
    (id, parent, parentStack, isReferenced) => {
      if (!isReferenced || excludedIds.has(id)) {
        return false
      }
      // locate current scope
      let i = parentStack.length
      while (i--) {
        const node = parentStack[i]
        if (node.type === 'BlockStatement') {
          const scope = blockToScopeMap.get(node)
          if (scope && checkRefId(scope, id, parent, parentStack)) {
            return
          }
        }
      }
      checkRefId(rootScope, id, parent, parentStack)
    },
    node => {
      if (isToRefCall(node)) {
        s.remove(node.callee.start! + offset, node.callee.end! + offset)
        return false // skip walk
      }
    },
    true, // invoke on ALL
    false // skip scope analysis since we did it already
  )

  function checkRefId(
    scope: Scope,
    id: Identifier,
    parent: Node,
    parentStack: Node[]
  ): boolean {
    if (id.name in scope) {
      if (scope[id.name]) {
        if (isStaticProperty(parent) && parent.shorthand) {
          // let binding used in a property shorthand
          // { foo } -> { foo: foo.value }
          // skip for destructure patterns
          if (
            !(parent as any).inPattern ||
            isInDestructureAssignment(parent, parentStack)
          ) {
            s.appendLeft(id.end! + offset, `: ${id.name}.value`)
          }
        } else {
          s.appendLeft(id.end! + offset, '.value')
        }
      }
      return true
    }
    return false
  }

  return {
    rootVars: Object.keys(rootScope).filter(key => rootScope[key]),
    importedHelpers: [...importedHelpers]
  }
}

function isToVarCall(node: Node): string | false {
  if (node.type !== 'CallExpression' || node.callee.type !== 'Identifier') {
    return false
  }
  const callee = node.callee.name
  if (callee === TO_VAR_SYMBOL) {
    return TO_VAR_SYMBOL
  }
  if (callee[0] === TO_VAR_SYMBOL && shorthands.includes(callee.slice(1))) {
    return callee
  }
  return false
}

function isToRefCall(node: Node): node is CallExpression {
  return (
    node.type === 'CallExpression' &&
    (node.callee as Identifier).name === TO_REF_SYMBOL
  )
}
