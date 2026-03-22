import {
  type CompilerOptions,
  type RootNode,
  baseParse,
  parserOptions,
  trackVForSlotScopes,
  transform,
  transformVBindShorthand,
} from '@vue/compiler-dom'
import { extend } from '@vue/shared'
import { spatialCodegenTransform } from './spatialCodegenTransform'
import { spatialTransformIf } from './transforms/spatialVIf'
import { spatialTransformFor } from './transforms/spatialVFor'
import {
  type BridgeManifest,
  createBridgeManifest,
  generateSwiftView,
} from './swiftCodegen'

export interface SpatialCompilerOptions extends CompilerOptions {
  componentName?: string
}

export interface SpatialCodegenResult {
  swift: string
  bridgeManifest: BridgeManifest
  lines: string[]
}

export function compile(
  source: string | RootNode,
  options: SpatialCompilerOptions = {},
): SpatialCodegenResult {
  options = extend({}, options, parserOptions, {
    // Don't prefix identifiers with _ctx — we generate Swift, not JS
    prefixIdentifiers: false,
    cacheHandlers: false,
    hoistStatic: false,
  })

  const ast = typeof source === 'string' ? baseParse(source, options) : source

  transform(
    ast,
    extend({}, options, {
      hoistStatic: false,
      nodeTransforms: [
        transformVBindShorthand,
        spatialTransformIf,
        spatialTransformFor,
        trackVForSlotScopes,
        // No transformExpression — we want raw identifiers for Swift codegen
      ].concat(options.nodeTransforms || []),
      directiveTransforms: extend({}, options.directiveTransforms || {}),
    }),
  )

  // Second pass: generate Swift code from AST
  const lines = spatialCodegenTransform(ast, options)
  const componentName = options.componentName || 'SpatialView'
  const swift = generateSwiftView(componentName, lines)
  const bridgeManifest = createBridgeManifest(componentName)

  return {
    swift,
    bridgeManifest,
    lines,
  }
}

export {
  SpatialErrorCodes,
  SpatialErrorMessages,
  createSpatialCompilerError,
} from './errors'

export {
  ELEMENT_MAP,
  CONSTRUCTOR_PROPS,
  MODIFIER_PROPS,
  STYLE_MAP,
  generateSwiftView,
  createBridgeManifest,
  type BridgeManifest,
} from './swiftCodegen'
