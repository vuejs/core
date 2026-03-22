import {
  type AttributeNode,
  type DirectiveNode,
  type ExpressionNode,
  type InterpolationNode,
  NodeTypes,
  type PlainElementNode,
  type SimpleExpressionNode,
  type TextNode,
  isStaticExp,
} from '@vue/compiler-dom'
import {
  type SpatialTransformContext,
  processChildren,
} from '../spatialCodegenTransform'
import { CONSTRUCTOR_PROPS, ELEMENT_MAP, MODIFIER_PROPS } from '../swiftCodegen'

/**
 * Safely extract the string content from an ExpressionNode.
 * For SimpleExpressionNode, returns .content.
 * For CompoundExpressionNode, returns a concatenated representation.
 */
function getExpContent(node: ExpressionNode): string {
  if (node.type === NodeTypes.SIMPLE_EXPRESSION) {
    return (node as SimpleExpressionNode).content
  }
  // CompoundExpression: join children that are strings or simple expressions
  if ('children' in node && Array.isArray((node as any).children)) {
    return (node as any).children
      .map((c: any) =>
        typeof c === 'string' ? c : c.content ? c.content : String(c),
      )
      .join('')
  }
  return ''
}

/** Get .value.content from an AttributeNode safely, without optional chaining */
function getAttrValue(prop: AttributeNode | undefined): string {
  if (prop && prop.value) {
    return prop.value.content
  }
  return ''
}

export function spatialProcessElement(
  node: PlainElementNode,
  context: SpatialTransformContext,
): void {
  const tag = node.tag
  const swiftView = ELEMENT_MAP[tag]

  if (!swiftView) {
    context.pushLine(`// Unknown element: <${tag}>`)
    context.pushLine(`Group {`)
    context.indent()
    processChildren(node, context)
    context.dedent()
    context.pushLine(`}`)
    return
  }

  const constructorArgs: string[] = []
  const modifiers: string[] = []
  const constructorPropsMap = CONSTRUCTOR_PROPS[swiftView] || {}
  let eventHandler: string | null = null

  for (const prop of node.props) {
    if (prop.type === NodeTypes.ATTRIBUTE) {
      processStaticProp(prop, constructorPropsMap, constructorArgs, modifiers)
    } else if (prop.type === NodeTypes.DIRECTIVE) {
      processDirectiveProp(prop, swiftView, constructorArgs, modifiers, context)
    }
  }

  // Check for @tap event handler
  const tapDir = node.props.find(
    p =>
      p.type === NodeTypes.DIRECTIVE &&
      p.name === 'on' &&
      p.arg &&
      isStaticExp(p.arg) &&
      p.arg.content === 'tap',
  ) as DirectiveNode | undefined

  if (tapDir && tapDir.exp) {
    eventHandler = getExpContent(tapDir.exp)
  }

  const textContent = extractTextContent(node)

  switch (swiftView) {
    case 'Text':
      emitText(textContent, modifiers, context)
      break
    case 'Button':
      emitButton(node, eventHandler, modifiers, context)
      break
    case 'Image':
      emitImage(node, tag, modifiers, context)
      break
    case 'TextField':
      emitTextField(node, modifiers, context)
      break
    case 'Toggle':
      emitToggle(node, modifiers, context)
      break
    case 'Slider':
      emitSlider(node, modifiers, context)
      break
    case 'Divider':
    case 'Spacer':
      context.pushLine(`${swiftView}()`)
      emitModifiers(modifiers, context)
      break
    case 'Model3D':
      emitModel3D(node, modifiers, context)
      break
    case 'WindowGroup':
      emitWindowGroup(node, tag, modifiers, context)
      break
    case 'ImmersiveSpace':
      emitImmersiveSpace(node, modifiers, context)
      break
    default:
      emitContainerView(node, swiftView, constructorArgs, modifiers, context)
      break
  }
}

function processStaticProp(
  prop: AttributeNode,
  constructorPropsMap: Record<string, string>,
  constructorArgs: string[],
  modifiers: string[],
): void {
  const name = prop.name
  const value = prop.value ? prop.value.content : ''

  if (name in constructorPropsMap) {
    const swiftParam = constructorPropsMap[name]
    if (swiftParam) {
      constructorArgs.push(`${swiftParam}: ${formatSwiftValue(name, value)}`)
    } else {
      constructorArgs.push(formatSwiftValue(name, value))
    }
    return
  }

  const modifierFn = MODIFIER_PROPS[name]
  if (modifierFn) {
    modifiers.push(modifierFn(value))
    return
  }
}

function processDirectiveProp(
  prop: DirectiveNode,
  swiftView: string,
  constructorArgs: string[],
  modifiers: string[],
  context: SpatialTransformContext,
): void {
  // v-bind (:prop="expr")
  if (prop.name === 'bind' && prop.arg && isStaticExp(prop.arg) && prop.exp) {
    const attrName = prop.arg.content
    const expr = getExpContent(prop.exp)

    const modifierFn = MODIFIER_PROPS[attrName]
    if (modifierFn) {
      modifiers.push(modifierFn(`vm.get("${expr}")`))
      return
    }

    const constructorPropsMap = CONSTRUCTOR_PROPS[swiftView] || {}
    if (attrName in constructorPropsMap) {
      const swiftParam = constructorPropsMap[attrName]
      if (swiftParam) {
        constructorArgs.push(`${swiftParam}: vm.get("${expr}")`)
      } else {
        constructorArgs.push(`vm.get("${expr}")`)
      }
    }
    return
  }

  // v-show
  if (prop.name === 'show' && prop.exp) {
    modifiers.push(`.opacity(vm.get("${getExpContent(prop.exp)}") ? 1 : 0)`)
    return
  }

  // Spatial gesture directives
  if (prop.name === 'spatial-drag' && prop.exp) {
    context.spatialGestures.push(getExpContent(prop.exp))
    modifiers.push(
      `.gesture(DragGesture().onChanged { value in vm.emit("spatial:drag", value.asBridgePayload()) })`,
    )
    return
  }

  if (prop.name === 'spatial-rotate' && prop.exp) {
    context.spatialGestures.push(getExpContent(prop.exp))
    modifiers.push(
      `.gesture(RotateGesture3D().onChanged { value in vm.emit("spatial:rotate", value.asBridgePayload()) })`,
    )
    return
  }

  if (prop.name === 'spatial-look' && prop.exp) {
    modifiers.push(`.hoverEffect(.${getExpContent(prop.exp)})`)
    return
  }
}

function extractTextContent(node: PlainElementNode): string | null {
  if (node.children.length === 0) return null
  if (node.children.length === 1 && node.children[0].type === NodeTypes.TEXT) {
    return `"${escapeSwiftString((node.children[0] as TextNode).content.trim())}"`
  }
  if (
    node.children.length === 1 &&
    node.children[0].type === NodeTypes.INTERPOLATION
  ) {
    const expr = (node.children[0] as InterpolationNode).content
    const content = getExpContent(expr)
    return `vm.get("${content}")`
  }
  return buildMixedContent(node)
}

function buildMixedContent(node: PlainElementNode): string | null {
  const parts: string[] = []
  for (const child of node.children) {
    if (child.type === NodeTypes.TEXT) {
      const text = child.content.trim()
      if (text) parts.push(text)
    } else if (child.type === NodeTypes.INTERPOLATION) {
      parts.push(`\\(vm.get("${getExpContent(child.content)}"))`)
    }
  }
  if (parts.length === 0) return null
  return `"${parts.join('')}"`
}

// --- Emitters ---

function emitText(
  textContent: string | null,
  modifiers: string[],
  context: SpatialTransformContext,
): void {
  context.pushLine(`Text(${textContent || '""'})`)
  emitModifiers(modifiers, context)
}

function emitButton(
  node: PlainElementNode,
  eventHandler: string | null,
  modifiers: string[],
  context: SpatialTransformContext,
): void {
  const eventId = eventHandler || 'tap:button'
  const action = `{ vm.emit("${eventId}") }`

  if (node.children.length > 0) {
    context.pushLine(`Button(action: ${action}) {`)
    context.indent()
    processChildren(node, context)
    context.dedent()
    context.pushLine(`}`)
  } else {
    context.pushLine(`Button(action: ${action}) { }`)
  }
  emitModifiers(modifiers, context)
  context.events.set(eventId, eventHandler || '')
}

function emitImage(
  node: PlainElementNode,
  originalTag: string,
  modifiers: string[],
  context: SpatialTransformContext,
): void {
  if (originalTag === 'sf-symbol') {
    const nameProp = findAttr(node, 'name')
    context.pushLine(`Image(systemName: "${getAttrValue(nameProp)}")`)
  } else {
    const srcProp = findAttr(node, 'src')
    context.pushLine(`Image("${getAttrValue(srcProp)}")`)
  }
  emitModifiers(modifiers, context)
}

function emitTextField(
  node: PlainElementNode,
  modifiers: string[],
  context: SpatialTransformContext,
): void {
  const placeholderProp = findAttr(node, 'placeholder')
  const placeholder = getAttrValue(placeholderProp)

  const vModelDir = node.props.find(
    p => p.type === NodeTypes.DIRECTIVE && p.name === 'model',
  ) as DirectiveNode | undefined

  if (vModelDir && vModelDir.exp) {
    const bindingKey = getExpContent(vModelDir.exp)
    context.pushLine(
      `TextField("${placeholder}", text: vm.binding("${bindingKey}"))`,
    )
    context.bindings.push(bindingKey)
  } else {
    context.pushLine(`TextField("${placeholder}", text: .constant(""))`)
  }
  emitModifiers(modifiers, context)
}

function emitToggle(
  node: PlainElementNode,
  modifiers: string[],
  context: SpatialTransformContext,
): void {
  const vModelDir = node.props.find(
    p => p.type === NodeTypes.DIRECTIVE && p.name === 'model',
  ) as DirectiveNode | undefined

  if (vModelDir && vModelDir.exp) {
    const bindingKey = getExpContent(vModelDir.exp)
    const textContent = extractTextContent(node)
    if (textContent) {
      context.pushLine(
        `Toggle(${textContent}, isOn: vm.binding("${bindingKey}"))`,
      )
    } else {
      context.pushLine(`Toggle(isOn: vm.binding("${bindingKey}")) { }`)
    }
    context.bindings.push(bindingKey)
  } else {
    context.pushLine(`Toggle(isOn: .constant(false)) { }`)
  }
  emitModifiers(modifiers, context)
}

function emitSlider(
  node: PlainElementNode,
  modifiers: string[],
  context: SpatialTransformContext,
): void {
  const valueBind = node.props.find(
    p =>
      p.type === NodeTypes.DIRECTIVE &&
      p.name === 'bind' &&
      p.arg &&
      isStaticExp(p.arg) &&
      p.arg.content === 'value',
  ) as DirectiveNode | undefined

  const rangeBind = node.props.find(
    p =>
      p.type === NodeTypes.DIRECTIVE &&
      p.name === 'bind' &&
      p.arg &&
      isStaticExp(p.arg) &&
      p.arg.content === 'range',
  ) as DirectiveNode | undefined

  const valueExpr =
    valueBind && valueBind.exp ? getExpContent(valueBind.exp) : undefined
  const rangeExpr =
    rangeBind && rangeBind.exp ? getExpContent(rangeBind.exp) : undefined

  let sliderLine = 'Slider('
  if (valueExpr) {
    sliderLine += `value: vm.binding("${valueExpr}")`
    context.bindings.push(valueExpr)
  } else {
    sliderLine += `value: .constant(0)`
  }
  if (rangeExpr) {
    sliderLine += `, in: ${rangeExpr}`
  }
  sliderLine += ')'
  context.pushLine(sliderLine)
  emitModifiers(modifiers, context)
}

function emitModel3D(
  node: PlainElementNode,
  modifiers: string[],
  context: SpatialTransformContext,
): void {
  const srcProp = findAttr(node, 'src')
  context.pushLine(`Model3D(named: "${getAttrValue(srcProp)}")`)
  emitModifiers(modifiers, context)
}

function emitWindowGroup(
  node: PlainElementNode,
  originalTag: string,
  modifiers: string[],
  context: SpatialTransformContext,
): void {
  const titleProp = findAttr(node, 'title')
  context.pushLine(`WindowGroup("${getAttrValue(titleProp)}") {`)
  context.indent()
  processChildren(node, context)
  context.dedent()
  context.pushLine(`}`)

  if (originalTag === 'spatial-volume') {
    modifiers.push('.windowStyle(.volumetric)')
  }
  emitModifiers(modifiers, context)
}

function emitImmersiveSpace(
  node: PlainElementNode,
  modifiers: string[],
  context: SpatialTransformContext,
): void {
  const idProp = findAttr(node, 'id')
  const id = getAttrValue(idProp) || 'immersive'

  context.pushLine(`ImmersiveSpace(id: "${id}") {`)
  context.indent()
  processChildren(node, context)
  context.dedent()
  context.pushLine(`}`)
  emitModifiers(modifiers, context)
}

function emitContainerView(
  node: PlainElementNode,
  swiftView: string,
  constructorArgs: string[],
  modifiers: string[],
  context: SpatialTransformContext,
): void {
  const args =
    constructorArgs.length > 0 ? `(${constructorArgs.join(', ')})` : ''

  if (node.children.length > 0) {
    context.pushLine(`${swiftView}${args} {`)
    context.indent()
    processChildren(node, context)
    context.dedent()
    context.pushLine(`}`)
  } else {
    context.pushLine(`${swiftView}${args} { }`)
  }
  emitModifiers(modifiers, context)
}

function emitModifiers(
  modifiers: string[],
  context: SpatialTransformContext,
): void {
  for (const mod of modifiers) {
    context.pushLine(mod)
  }
}

/** Find a static attribute by name on a node */
function findAttr(
  node: PlainElementNode,
  name: string,
): AttributeNode | undefined {
  return node.props.find(
    p => p.type === NodeTypes.ATTRIBUTE && p.name === name,
  ) as AttributeNode | undefined
}

function formatSwiftValue(propName: string, value: string): string {
  if (/^\d+(\.\d+)?$/.test(value)) return value
  if (propName === 'alignment') return `.${value}`
  return `"${value}"`
}

function escapeSwiftString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
}
