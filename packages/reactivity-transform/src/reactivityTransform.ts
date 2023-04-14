import {
  Node,
  Identifier,
  BlockStatement,
  CallExpression,
  ObjectPattern,
  ArrayPattern,
  Program,
  VariableDeclarator,
  Expression,
  VariableDeclaration,
  ImportDeclaration,
  ImportSpecifier,
  ImportDefaultSpecifier,
  ImportNamespaceSpecifier
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
import { hasOwn, isArray, isString, genPropsAccessExp } from '@vue/shared'

const CONVERT_SYMBOL = '$'
const ESCAPE_SYMBOL = '$$'
const IMPORT_SOURCE = 'vue/macros'
const shorthands = ['ref', 'computed', 'shallowRef', 'toRef', 'customRef']
const transformCheckRE = /[^\w]\$(?:\$|ref|computed|shallowRef)?\s*(\(|\<)/

export function shouldTransform(src: string): boolean {
  return transformCheckRE.test(src)
}

interface Binding {
  isConst?: boolean
  isProp?: boolean
}
type Scope = Record<string, Binding | false>

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

export interface ImportBinding {
  local: string
  imported: string
  source: string
  specifier: ImportSpecifier | ImportDefaultSpecifier | ImportNamespaceSpecifier
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
    plugins
  })
  const s = new MagicString(src)
  const res = transformAST(ast.program, s, 0)

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
      isConst?: boolean
    }
  >
): {
  rootRefs: string[]
  importedHelpers: string[]
} {
  warnExperimental()

  const userImports: Record<string, ImportBinding> = Object.create(null)
  for (const node of ast.body) {
    if (node.type !== 'ImportDeclaration') continue
    walkImportDeclaration(node)
  }

  // macro import handling
  let convertSymbol: string | undefined
  let escapeSymbol: string | undefined
  for (const { local, imported, source, specifier } of Object.values(
    userImports
  )) {
    if (source === IMPORT_SOURCE) {
      if (imported === ESCAPE_SYMBOL) {
        escapeSymbol = local
      } else if (imported === CONVERT_SYMBOL) {
        convertSymbol = local
      } else if (imported !== local) {
        error(
          `macro imports for ref-creating methods do not support aliasing.`,
          specifier
        )
      }
    }
  }

  // default symbol
  if (!convertSymbol && !userImports[CONVERT_SYMBOL]) {
    convertSymbol = CONVERT_SYMBOL
  }
  if (!escapeSymbol && !userImports[ESCAPE_SYMBOL]) {
    escapeSymbol = ESCAPE_SYMBOL
  }

  const importedHelpers = new Set<string>()
  const rootScope: Scope = {}
  const scopeStack: Scope[] = [rootScope]
  let currentScope: Scope = rootScope
  let escapeScope: CallExpression | undefined // inside $$()
  const excludedIds = new WeakSet<Identifier>()
  const parentStack: Node[] = []
  const propsLocalToPublicMap: Record<string, string> = Object.create(null)

  if (knownRefs) {
    for (const key of knownRefs) {
      rootScope[key] = {}
    }
  }
  if (knownProps) {
    for (const key in knownProps) {
      const { local, isConst } = knownProps[key]
      rootScope[local] = {
        isProp: true,
        isConst: !!isConst
      }
      propsLocalToPublicMap[local] = key
    }
  }

  function walkImportDeclaration(node: ImportDeclaration) {
    const source = node.source.value
    if (source === IMPORT_SOURCE) {
      s.remove(node.start! + offset, node.end! + offset)
    }

    for (const specifier of node.specifiers) {
      const local = specifier.local.name
      const imported =
        (specifier.type === 'ImportSpecifier' &&
          specifier.imported.type === 'Identifier' &&
          specifier.imported.name) ||
        'default'
      userImports[local] = {
        source,
        local,
        imported,
        specifier
      }
    }
  }

  function isRefCreationCall(callee: string): string | false {
    if (!convertSymbol || currentScope[convertSymbol] !== undefined) {
      return false
    }
    if (callee === convertSymbol) {
      return convertSymbol
    }
    if (callee[0] === '$' && shorthands.includes(callee.slice(1))) {
      return callee
    }
    return false
  }

  function error(msg: string, node: Node): never {
    const e = new Error(msg)
    ;(e as any).node = node
    throw e
  }

  function helper(msg: string) {
    importedHelpers.add(msg)
    return `_${msg}`
  }

  function registerBinding(id: Identifier, binding?: Binding) {
    excludedIds.add(id)
    if (currentScope) {
      currentScope[id.name] = binding ? binding : false
    } else {
      error(
        'registerBinding called without active scope, something is wrong.',
        id
      )
    }
  }

  const registerRefBinding = (id: Identifier, isConst = false) =>
    registerBinding(id, { isConst })

  let tempVarCount = 0
  function genTempVar() {
    return `__$temp_${++tempVarCount}`
  }

  function snip(node: Node) {
    return s.original.slice(node.start! + offset, node.end! + offset)
  }

  function walkScope(node: Program | BlockStatement, isRoot = false) {
    for (const stmt of node.body) {
      if (stmt.type === 'VariableDeclaration') {
        walkVariableDeclaration(stmt, isRoot)
      } else if (
        stmt.type === 'FunctionDeclaration' ||
        stmt.type === 'ClassDeclaration'
      ) {
        if (stmt.declare || !stmt.id) continue
        registerBinding(stmt.id)
      } else if (
        (stmt.type === 'ForOfStatement' || stmt.type === 'ForInStatement') &&
        stmt.left.type === 'VariableDeclaration'
      ) {
        walkVariableDeclaration(stmt.left)
      } else if (
        stmt.type === 'ExportNamedDeclaration' &&
        stmt.declaration &&
        stmt.declaration.type === 'VariableDeclaration'
      ) {
        walkVariableDeclaration(stmt.declaration, isRoot)
      } else if (
        stmt.type === 'LabeledStatement' &&
        stmt.body.type === 'VariableDeclaration'
      ) {
        walkVariableDeclaration(stmt.body, isRoot)
      }
    }
  }

  function walkVariableDeclaration(stmt: VariableDeclaration, isRoot = false) {
    if (stmt.declare) {
      return
    }
    for (const decl of stmt.declarations) {
      let refCall
      const isCall =
        decl.init &&
        decl.init.type === 'CallExpression' &&
        decl.init.callee.type === 'Identifier'
      if (
        isCall &&
        (refCall = isRefCreationCall((decl as any).init.callee.name))
      ) {
        processRefDeclaration(
          refCall,
          decl.id,
          decl.init as CallExpression,
          stmt.kind === 'const'
        )
      } else {
        const isProps =
          isRoot && isCall && (decl as any).init.callee.name === 'defineProps'
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
  }

  function processRefDeclaration(
    method: string,
    id: VariableDeclarator['id'],
    call: CallExpression,
    isConst: boolean
  ) {
    excludedIds.add(call.callee as Identifier)
    if (method === convertSymbol) {
      // $
      // remove macro
      s.remove(call.callee.start! + offset, call.callee.end! + offset)
      if (id.type === 'Identifier') {
        // single variable
        registerRefBinding(id, isConst)
      } else if (id.type === 'ObjectPattern') {
        processRefObjectPattern(id, call, isConst)
      } else if (id.type === 'ArrayPattern') {
        processRefArrayPattern(id, call, isConst)
      }
    } else {
      // shorthands
      if (id.type === 'Identifier') {
        registerRefBinding(id, isConst)
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
    call: CallExpression,
    isConst: boolean,
    tempVar?: string,
    path: PathSegment[] = []
  ) {
    if (!tempVar) {
      tempVar = genTempVar()
      // const { x } = $(useFoo()) --> const __$temp_1 = useFoo()
      s.overwrite(pattern.start! + offset, pattern.end! + offset, tempVar)
    }

    let nameId: Identifier | undefined
    for (const p of pattern.properties) {
      let key: Expression | string | undefined
      let defaultValue: Expression | undefined
      if (p.type === 'ObjectProperty') {
        if (p.key.start! === p.value.start!) {
          // shorthand { foo }
          nameId = p.key as Identifier
          if (p.value.type === 'Identifier') {
            // avoid shorthand value identifier from being processed
            excludedIds.add(p.value)
          } else if (
            p.value.type === 'AssignmentPattern' &&
            p.value.left.type === 'Identifier'
          ) {
            // { foo = 1 }
            excludedIds.add(p.value.left)
            defaultValue = p.value.right
          }
        } else {
          key = p.computed ? (p.key as Expression) : (p.key as Identifier).name
          if (p.value.type === 'Identifier') {
            // { foo: bar }
            nameId = p.value
          } else if (p.value.type === 'ObjectPattern') {
            processRefObjectPattern(p.value, call, isConst, tempVar, [
              ...path,
              key
            ])
          } else if (p.value.type === 'ArrayPattern') {
            processRefArrayPattern(p.value, call, isConst, tempVar, [
              ...path,
              key
            ])
          } else if (p.value.type === 'AssignmentPattern') {
            if (p.value.left.type === 'Identifier') {
              // { foo: bar = 1 }
              nameId = p.value.left
              defaultValue = p.value.right
            } else if (p.value.left.type === 'ObjectPattern') {
              processRefObjectPattern(p.value.left, call, isConst, tempVar, [
                ...path,
                [key, p.value.right]
              ])
            } else if (p.value.left.type === 'ArrayPattern') {
              processRefArrayPattern(p.value.left, call, isConst, tempVar, [
                ...path,
                [key, p.value.right]
              ])
            } else {
              // MemberExpression case is not possible here, ignore
            }
          }
        }
      } else {
        // rest element { ...foo }
        error(`reactivity destructure does not support rest elements.`, p)
      }
      if (nameId) {
        registerRefBinding(nameId, isConst)
        // inject toRef() after original replaced pattern
        const source = pathToString(tempVar, path)
        const keyStr = isString(key)
          ? `'${key}'`
          : key
          ? snip(key)
          : `'${nameId.name}'`
        const defaultStr = defaultValue ? `, ${snip(defaultValue)}` : ``
        s.appendLeft(
          call.end! + offset,
          `,\n  ${nameId.name} = ${helper(
            'toRef'
          )}(${source}, ${keyStr}${defaultStr})`
        )
      }
    }
    if (nameId) {
      s.appendLeft(call.end! + offset, ';')
    }
  }

  function processRefArrayPattern(
    pattern: ArrayPattern,
    call: CallExpression,
    isConst: boolean,
    tempVar?: string,
    path: PathSegment[] = []
  ) {
    if (!tempVar) {
      // const [x] = $(useFoo()) --> const __$temp_1 = useFoo()
      tempVar = genTempVar()
      s.overwrite(pattern.start! + offset, pattern.end! + offset, tempVar)
    }

    let nameId: Identifier | undefined
    for (let i = 0; i < pattern.elements.length; i++) {
      const e = pattern.elements[i]
      if (!e) continue
      let defaultValue: Expression | undefined
      if (e.type === 'Identifier') {
        // [a] --> [__a]
        nameId = e
      } else if (e.type === 'AssignmentPattern') {
        // [a = 1]
        nameId = e.left as Identifier
        defaultValue = e.right
      } else if (e.type === 'RestElement') {
        // [...a]
        error(`reactivity destructure does not support rest elements.`, e)
      } else if (e.type === 'ObjectPattern') {
        processRefObjectPattern(e, call, isConst, tempVar, [...path, i])
      } else if (e.type === 'ArrayPattern') {
        processRefArrayPattern(e, call, isConst, tempVar, [...path, i])
      }
      if (nameId) {
        registerRefBinding(nameId, isConst)
        // inject toRef() after original replaced pattern
        const source = pathToString(tempVar, path)
        const defaultStr = defaultValue ? `, ${snip(defaultValue)}` : ``
        s.appendLeft(
          call.end! + offset,
          `,\n  ${nameId.name} = ${helper(
            'toRef'
          )}(${source}, ${i}${defaultStr})`
        )
      }
    }
    if (nameId) {
      s.appendLeft(call.end! + offset, ';')
    }
  }

  type PathSegmentAtom = Expression | string | number

  type PathSegment =
    | PathSegmentAtom
    | [PathSegmentAtom, Expression /* default value */]

  function pathToString(source: string, path: PathSegment[]): string {
    if (path.length) {
      for (const seg of path) {
        if (isArray(seg)) {
          source = `(${source}${segToString(seg[0])} || ${snip(seg[1])})`
        } else {
          source += segToString(seg)
        }
      }
    }
    return source
  }

  function segToString(seg: PathSegmentAtom): string {
    if (typeof seg === 'number') {
      return `[${seg}]`
    } else if (typeof seg === 'string') {
      return `.${seg}`
    } else {
      return snip(seg)
    }
  }

  function rewriteId(
    scope: Scope,
    id: Identifier,
    parent: Node,
    parentStack: Node[]
  ): boolean {
    if (hasOwn(scope, id.name)) {
      const binding = scope[id.name]

      if (binding) {
        if (
          binding.isConst &&
          ((parent.type === 'AssignmentExpression' && id === parent.left) ||
            parent.type === 'UpdateExpression')
        ) {
          error(`Assignment to constant variable.`, id)
        }

        const { isProp } = binding
        if (isStaticProperty(parent) && parent.shorthand) {
          // let binding used in a property shorthand
          // skip for destructure patterns
          if (
            !(parent as any).inPattern ||
            isInDestructureAssignment(parent, parentStack)
          ) {
            if (isProp) {
              if (escapeScope) {
                // prop binding in $$()
                // { prop } -> { prop: __props_prop }
                registerEscapedPropBinding(id)
                s.appendLeft(
                  id.end! + offset,
                  `: __props_${propsLocalToPublicMap[id.name]}`
                )
              } else {
                // { prop } -> { prop: __props.prop }
                s.appendLeft(
                  id.end! + offset,
                  `: ${genPropsAccessExp(propsLocalToPublicMap[id.name])}`
                )
              }
            } else {
              // { foo } -> { foo: foo.value }
              s.appendLeft(id.end! + offset, `: ${id.name}.value`)
            }
          }
        } else {
          if (isProp) {
            if (escapeScope) {
              // x --> __props_x
              registerEscapedPropBinding(id)
              s.overwrite(
                id.start! + offset,
                id.end! + offset,
                `__props_${propsLocalToPublicMap[id.name]}`
              )
            } else {
              // x --> __props.x
              s.overwrite(
                id.start! + offset,
                id.end! + offset,
                genPropsAccessExp(propsLocalToPublicMap[id.name])
              )
            }
          } else {
            // x --> x.value
            s.appendLeft(id.end! + offset, '.value')
          }
        }
      }
      return true
    }
    return false
  }

  const propBindingRefs: Record<string, true> = {}
  function registerEscapedPropBinding(id: Identifier) {
    if (!propBindingRefs.hasOwnProperty(id.name)) {
      propBindingRefs[id.name] = true
      const publicKey = propsLocalToPublicMap[id.name]
      s.prependRight(
        offset,
        `const __props_${publicKey} = ${helper(
          `toRef`
        )}(__props, '${publicKey}');\n`
      )
    }
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

      // catch param
      if (node.type === 'CatchClause') {
        scopeStack.push((currentScope = {}))
        if (node.param && node.param.type === 'Identifier') {
          registerBinding(node.param)
        }
        walkScope(node.body)
        return
      }

      // non-function block scopes
      if (node.type === 'BlockStatement' && !isFunctionType(parent!)) {
        scopeStack.push((currentScope = {}))
        walkScope(node)
        return
      }

      // skip type nodes
      if (
        parent &&
        parent.type.startsWith('TS') &&
        parent.type !== 'TSAsExpression' &&
        parent.type !== 'TSNonNullExpression' &&
        parent.type !== 'TSTypeAssertion'
      ) {
        return this.skip()
      }

      if (node.type === 'Identifier') {
        const binding = rootScope[node.name]
        if (
          // if inside $$(), skip unless this is a destructured prop binding
          !(escapeScope && (!binding || !binding.isProp)) &&
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
      }

      if (node.type === 'CallExpression' && node.callee.type === 'Identifier') {
        const callee = node.callee.name

        const refCall = isRefCreationCall(callee)
        if (refCall && (!parent || parent.type !== 'VariableDeclarator')) {
          return error(
            `${refCall} can only be used as the initializer of ` +
              `a variable declaration.`,
            node
          )
        }

        if (
          escapeSymbol &&
          currentScope[escapeSymbol] === undefined &&
          callee === escapeSymbol
        ) {
          escapeScope = node
          s.remove(node.callee.start! + offset, node.callee.end! + offset)

          if (parent?.type === 'ExpressionStatement') {
            // edge case where the call expression is an expression statement
            // if its own - prepend semicolon to avoid it being parsed as
            // function invocation of previous line
            let i =
              (node.leadingComments
                ? node.leadingComments[0].start
                : node.start)! + offset
            while (i--) {
              const char = s.original.charAt(i)
              if (char === '\n') {
                // only insert semi if it's actually the first thing after
                // newline
                s.prependRight(node.start! + offset, ';')
                break
              } else if (!/\s/.test(char)) {
                break
              }
            }
          }
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
      if (node === escapeScope) {
        escapeScope = undefined
      }
    }
  })

  return {
    rootRefs: Object.keys(rootScope).filter(key => {
      const binding = rootScope[key]
      return binding && !binding.isProp
    }),
    importedHelpers: [...importedHelpers]
  }
}

const hasWarned: Record<string, boolean> = {}

function warnExperimental() {
  // eslint-disable-next-line
  if (typeof window !== 'undefined') {
    return
  }
  warnOnce(
    `Reactivity Transform was an experimental feature and has now been deprecated. ` +
      `It will be removed from Vue core in 3.4. If you intend to continue using it, ` +
      `switch to https://vue-macros.sxzz.moe/features/reactivity-transform.html.\n` +
      `See reason for deprecation here: https://github.com/vuejs/rfcs/discussions/369#discussioncomment-5059028`
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
    `\x1b[1m\x1b[33m[@vue/reactivity-transform]\x1b[0m\x1b[33m ${msg}\x1b[0m\n`
  )
}
