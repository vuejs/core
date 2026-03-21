import type { SFCDescriptor } from './parse'

/**
 * Check whether an SFC descriptor represents a spatial component.
 * A spatial component has `<script setup spatial>` and compiles to SwiftUI
 * instead of DOM render functions.
 */
export function isSpatialComponent(descriptor: SFCDescriptor): boolean {
  return descriptor.spatial
}
