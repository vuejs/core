import { registerRuntimeHelpers } from '@vue/compiler-dom'

export const SPATIAL_INTERPOLATE: unique symbol = Symbol(`spatialInterpolate`)
export const SPATIAL_GET: unique symbol = Symbol(`spatialGet`)
export const SPATIAL_GET_ARRAY: unique symbol = Symbol(`spatialGetArray`)
export const SPATIAL_BINDING: unique symbol = Symbol(`spatialBinding`)
export const SPATIAL_EMIT: unique symbol = Symbol(`spatialEmit`)

export const spatialHelpers: Record<symbol, string> = {
  [SPATIAL_INTERPOLATE]: `spatialInterpolate`,
  [SPATIAL_GET]: `spatialGet`,
  [SPATIAL_GET_ARRAY]: `spatialGetArray`,
  [SPATIAL_BINDING]: `spatialBinding`,
  [SPATIAL_EMIT]: `spatialEmit`,
}

registerRuntimeHelpers(spatialHelpers)
