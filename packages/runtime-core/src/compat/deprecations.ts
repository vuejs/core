import { isRuntimeOnly } from '../component'
import { warn } from '../warning'

export const enum DeprecationTypes {
  CONFIG_SILENT,
  CONFIG_DEVTOOLS,
  CONFIG_KEY_CODES,
  CONFIG_PRODUCTION_TIP,
  CONFIG_IGNORED_ELEMENTS,

  GLOBAL_PROTOTYPE,
  GLOBAL_SET,
  GLOBAL_DELETE,
  GLOBAL_OBSERVABLE,
  GLOBAL_DOM_TEMPLATE_MOUNT,

  INSTANCE_SET,
  INSTANCE_DELETE,
  INSTANCE_MOUNT,
  INSTANCE_DESTROY,

  OPTIONS_DATA_FN,
  OPTIONS_DATA_MERGE,
  OPTIONS_BEFORE_DESTROY,
  OPTIONS_DESTROYED,

  PROPS_DEFAULT_THIS,

  CUSTOM_DIR
}

type DeprecationData = {
  message: string | ((...args: any[]) => string)
  link?: string
}

const deprecations: Record<DeprecationTypes, DeprecationData> = {
  [DeprecationTypes.CONFIG_SILENT]: {
    message:
      `config.silent has been removed because it is not good practice to ` +
      `intentionally suppress warnings. You can use your browser console's ` +
      `filter features to focus on relevant messages.`
  },

  [DeprecationTypes.CONFIG_DEVTOOLS]: {
    message:
      `config.devtools has been removed. To enable devtools for ` +
      `production, configure the __VUE_PROD_DEVTOOLS__ compile-time flag.`,
    link: `https://github.com/vuejs/vue-next/tree/master/packages/vue#bundler-build-feature-flags`
  },

  [DeprecationTypes.CONFIG_KEY_CODES]: {
    message:
      `config.keyCodes has been removed. ` +
      `In Vue 3, you can directly use the kebab-case key names as v-on modifiers.`,
    link: `https://v3.vuejs.org/guide/migration/keycode-modifiers.html`
  },

  [DeprecationTypes.CONFIG_PRODUCTION_TIP]: {
    message: `config.productionTip has been removed.`,
    link: `https://v3.vuejs.org/guide/migration/global-api.html#config-productiontip-removed`
  },

  [DeprecationTypes.CONFIG_IGNORED_ELEMENTS]: {
    message: () => {
      let msg = `config.ignoredElements has been removed.`
      if (isRuntimeOnly()) {
        msg += ` Pass the "isCustomElement" option to @vue/compiler-dom instead.`
      } else {
        msg += ` Use config.isCustomElement instead.`
      }
      return msg
    },
    link: `https://v3.vuejs.org/guide/migration/global-api.html#config-ignoredelements-is-now-config-iscustomelement`
  },

  [DeprecationTypes.GLOBAL_PROTOTYPE]: {
    message:
      `Vue.prototype is no longer available in Vue 3. ` +
      `Use config.globalProperties instead.`,
    link: `https://v3.vuejs.org/guide/migration/global-api.html#vue-prototype-replaced-by-config-globalproperties`
  },

  [DeprecationTypes.GLOBAL_SET]: {
    message:
      `Vue.set() has been removed as it is no longer needed in Vue 3. ` +
      `Simply use native JavaScript mutations.`
  },

  [DeprecationTypes.GLOBAL_DELETE]: {
    message:
      `Vue.delete() has been removed as it is no longer needed in Vue 3. ` +
      `Simply use native JavaScript mutations.`
  },

  [DeprecationTypes.GLOBAL_OBSERVABLE]: {
    message:
      `Vue.observable() has been removed. ` +
      `Use \`import { reactive } from "vue"\` from Composition API instead.`,
    link: `https://v3.vuejs.org/api/basic-reactivity.html`
  },

  [DeprecationTypes.GLOBAL_DOM_TEMPLATE_MOUNT]: {
    message:
      `Vue detected directives on the mount container. ` +
      `In Vue 3, the container is no longer considered part of the template ` +
      `and will not be processed/replaced.`,
    link: `https://v3.vuejs.org/guide/migration/mount-changes.html`
  },

  [DeprecationTypes.INSTANCE_SET]: {
    message:
      `vm.$set() has been removed as it is no longer needed in Vue 3. ` +
      `Simply use native JavaScript mutations.`
  },

  [DeprecationTypes.INSTANCE_DELETE]: {
    message:
      `vm.$delete() has been removed as it is no longer needed in Vue 3. ` +
      `Simply use native JavaScript mutations.`
  },

  [DeprecationTypes.INSTANCE_MOUNT]: {
    message:
      `The global app boostrapping API has changed: vm.$mount() and the "el" ` +
      `option have been removed. Use createApp(RootComponent).mount() instead.`,
    link: `https://v3.vuejs.org/guide/migration/global-api.html#mounting-app-instance`
  },

  [DeprecationTypes.INSTANCE_DESTROY]: {
    message: `vm.$destroy() has been removed. Use app.unmount() instead.`,
    link: `https://v3.vuejs.org/api/application-api.html#unmount`
  },

  [DeprecationTypes.OPTIONS_DATA_FN]: {
    message:
      `The "data" option can no longer be a plain object. ` +
      `Always use a function.`,
    link: `https://v3.vuejs.org/guide/migration/data-option.html`
  },

  [DeprecationTypes.OPTIONS_DATA_MERGE]: {
    message: (key: string) =>
      `Detected conflicting key "${key}" when merging data option values. ` +
      `In Vue 3, data keys are merged shallowly and will override one another.`,
    link: `https://v3.vuejs.org/guide/migration/data-option.html#mixin-merge-behavior-change`
  },

  [DeprecationTypes.OPTIONS_BEFORE_DESTROY]: {
    message: `\`beforeDestroy\` has been renamed to \`beforeUnmount\`.`
  },

  [DeprecationTypes.OPTIONS_DESTROYED]: {
    message: `\`destroyed\` has been renamed to \`unmounted\`.`
  },

  [DeprecationTypes.PROPS_DEFAULT_THIS]: {
    message: (key: string) =>
      `props default value function no longer has access to "this". ` +
      `(found in prop "${key}")`,
    link: `https://v3.vuejs.org/guide/migration/props-default-this.html`
  },

  [DeprecationTypes.CUSTOM_DIR]: {
    message: (legacyHook: string, newHook: string) =>
      `Custom directive hook "${legacyHook}" has been removed. ` +
      `Use "${newHook}" instead.`,
    link: `https://v3.vuejs.org/guide/migration/custom-directives.html`
  }
}

export function warnDeprecation(key: DeprecationTypes, ...args: any[]) {
  if (!__COMPAT__ || !__DEV__) {
    return
  }
  const { message, link } = deprecations[key]
  warn(
    `[DEPRECATION] ${
      typeof message === 'function' ? message(...args) : message
    }${link ? `\n  Details: ${link}` : ``}`
  )
}
