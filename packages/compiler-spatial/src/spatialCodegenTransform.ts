import {
  type CompilerError,
  type CompilerOptions,
  ElementTypes,
  type ForNode,
  type IfNode,
  NodeTypes,
  type PlainElementNode,
  type RootNode,
  type TemplateChildNode,
} from '@vue/compiler-dom'
import { SpatialErrorCodes, createSpatialCompilerError } from './errors'
import { spatialProcessElement } from './transforms/spatialTransformElement'
import { spatialProcessIf } from './transforms/spatialVIf'
import { spatialProcessFor } from './transforms/spatialVFor'
import { ELEMENT_MAP } from './swiftCodegen'

export interface SpatialTransformContext {
  root: RootNode
  options: CompilerOptions
  lines: string[]
  indentLevel: number
  events: Map<string, string>
  bindings: string[]
  spatialGestures: string[]
  onError: (error: CompilerError) => void
  pushLine(line: string): void
  indent(): void
  dedent(): void
}

export function createSpatialTransformContext(
  root: RootNode,
  options: CompilerOptions,
): SpatialTransformContext {
  const lines: string[] = []
  let indentLevel = 0

  return {
    root,
    options,
    lines,
    indentLevel,
    events: new Map(),
    bindings: [],
    spatialGestures: [],
    onError:
      options.onError ||
      (e => {
        throw e
      }),
    pushLine(line: string) {
      lines.push('    '.repeat(indentLevel) + line)
    },
    indent() {
      indentLevel++
      this.indentLevel = indentLevel
    },
    dedent() {
      indentLevel--
      this.indentLevel = indentLevel
    },
  }
}

export function spatialCodegenTransform(
  ast: RootNode,
  options: CompilerOptions,
): string[] {
  const context = createSpatialTransformContext(ast, options)
  processChildren(ast, context)
  return context.lines
}

interface Container {
  children: TemplateChildNode[]
}

export function processChildren(
  parent: Container,
  context: SpatialTransformContext,
): void {
  const { children } = parent
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    switch (child.type) {
      case NodeTypes.ELEMENT:
        switch (child.tagType) {
          case ElementTypes.ELEMENT:
            spatialProcessElement(child, context)
            break
          case ElementTypes.COMPONENT:
            // Hyphenated tags are classified as components by the parser,
            // but in spatial templates many are mapped to SwiftUI views.
            if (child.tag in ELEMENT_MAP) {
              spatialProcessElement(
                child as unknown as PlainElementNode,
                context,
              )
            } else {
              // Actual Vue component reference
              context.pushLine(`// Component: ${child.tag}`)
            }
            break
          case ElementTypes.SLOT:
            context.pushLine(`// Slot`)
            break
          case ElementTypes.TEMPLATE:
            // Process children of <template> wrapper
            processChildren(child, context)
            break
          default:
            context.onError(
              createSpatialCompilerError(
                SpatialErrorCodes.X_SPATIAL_INVALID_AST_NODE,
                (child as any).loc,
              ),
            )
            // make sure we exhaust all possible types
            const _exhaustiveCheck: never = child
            return _exhaustiveCheck
        }
        break
      case NodeTypes.TEXT:
        if (child.content.trim()) {
          context.pushLine(`Text("${escapeSwiftString(child.content.trim())}")`)
        }
        break
      case NodeTypes.INTERPOLATION:
        context.pushLine(
          `Text(vm.get("${getExpressionContent(child.content)}"))`,
        )
        break
      case NodeTypes.IF:
        spatialProcessIf(child as IfNode, context)
        break
      case NodeTypes.FOR:
        spatialProcessFor(child as ForNode, context)
        break
      case NodeTypes.COMMENT:
        context.pushLine(`// ${child.content}`)
        break
      case NodeTypes.IF_BRANCH:
        // handled by spatialProcessIf
        break
      case NodeTypes.TEXT_CALL:
      case NodeTypes.COMPOUND_EXPRESSION:
        // not expected in spatial templates
        break
      default:
        context.onError(
          createSpatialCompilerError(
            SpatialErrorCodes.X_SPATIAL_INVALID_AST_NODE,
            (child as any).loc,
          ),
        )
        // make sure we exhaust all possible types
        const _exhaustiveCheck2: never = child
        return _exhaustiveCheck2
    }
  }
}

function getExpressionContent(node: any): string {
  if (typeof node === 'string') return node
  if (node.content) return node.content
  return String(node)
}

function escapeSwiftString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
}
