import type { InjectionKey, Ref } from 'vue'

export const themeKey: InjectionKey<Ref<'light' | 'dark'>> = Symbol('theme')
