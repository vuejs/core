/// <reference types="vite/client" />

// Global compile-time constants
declare var __COMMIT__: string

declare module 'file-saver' {
  export function saveAs(blob: any, name: any): void
}
