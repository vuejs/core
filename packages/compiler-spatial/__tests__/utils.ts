import { type SpatialCodegenResult, compile } from '../src'

export function compileSpatial(
  template: string,
  componentName = 'TestView',
): SpatialCodegenResult {
  return compile(template, { componentName })
}

export function getSwiftLines(template: string): string[] {
  const { lines } = compileSpatial(template)
  return lines
}

export function getSwift(template: string, componentName = 'TestView'): string {
  const { swift } = compileSpatial(template, componentName)
  return swift
}
