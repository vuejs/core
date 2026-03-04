import { initDev } from './dev'

if (__DEV__) {
  initDev()
}

export * from '@vue/runtime-dom'
