import type { VaporRenderResult } from 'vue'

declare module 'vue' {
  interface RenderResultExtensions {
    vapor: VaporRenderResult
  }
}
