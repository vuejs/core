import { isRuntimeOnly } from '../component'
import { warn } from '../warning'
import { getCompatConfig } from './compatConfig'

export const enum DeprecationTypes {
  CONFIG_SILENT = 'CONFIG_SILENT',
  CONFIG_DEVTOOLS = 'CONFIG_DEVTOOLS',
  CONFIG_KEY_CODES = 'CONFIG_KEY_CODES',
  CONFIG_PRODUCTION_TIP = 'CONFIG_PRODUCTION_TIP',
  CONFIG_IGNORED_ELEMENTS = 'CONFIG_IGNORED_ELEMENTS',

  GLOBAL_PROTOTYPE = 'GLOBAL_PROTOTYPE',
  GLOBAL_SET = 'GLOBAL_SET',
  GLOBAL_DELETE = 'GLOBAL_DELETE',
  GLOBAL_OBSERVABLE = 'GLOBAL_OBSERVABLE',
  GLOBAL_MOUNT_CONTAINER = 'GLOBAL_MOUNT_CONTAINER',

  INSTANCE_SET = 'INSTANCE_SET',
  INSTANCE_DELETE = 'INSTANCE_DELETE',
  INSTANCE_MOUNT = 'INSTANCE_MOUNT',
  INSTANCE_DESTROY = 'INSTANCE_DESTROY',
  INSTANCE_EVENT_EMITTER = 'INSTANCE_EVENT_EMITTER',
  INSTANCE_EVENT_HOOKS = 'INSTANCE_EVENT_HOOKS',
  INSTANCE_CHILDREN = 'INSTANCE_CHILDREN',

  OPTIONS_DATA_FN = 'OPTIONS_DATA_FN',
  OPTIONS_DATA_MERGE = 'OPTIONS_DATA_MERGE',
  OPTIONS_BEFORE_DESTROY = 'OPTIONS_BEFORE_DESTROY',
  OPTIONS_DESTROYED = 'OPTIONS_DESTROYED',

  PROPS_DEFAULT_THIS = 'PROPS_DEFAULT_THIS',

  CUSTOM_DIR = 'CUSTOM_DIR',

  V_ON_KEYCODE_MODIFIER = 'V_ON_KEYCODE_MODIFIER'
}

type DeprecationData = {
  message: string | ((...args: any[]) => string)
  link?: string
}

const deprecationMessages: Record<DeprecationTypes, DeprecationData> = {
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

  [DeprecationTypes.GLOBAL_MOUNT_CONTAINER]: {
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
      `The global app bootstrapping API has changed: vm.$mount() and the "el" ` +
      `option have been removed. Use createApp(RootComponent).mount() instead.`,
    link: `https://v3.vuejs.org/guide/migration/global-api.html#mounting-app-instance`
  },

  [DeprecationTypes.INSTANCE_DESTROY]: {
    message: `vm.$destroy() has been removed. Use app.unmount() instead.`,
    link: `https://v3.vuejs.org/api/application-api.html#unmount`
  },

  [DeprecationTypes.INSTANCE_EVENT_EMITTER]: {
    message:
      `vm.$on/$once/$off() have been removed. ` +
      `Use an external event emitter library instead.`,
    link: `https://v3.vuejs.org/guide/migration/events-api.html`
  },

  [DeprecationTypes.INSTANCE_EVENT_HOOKS]: {
    message:
      `"hook:x" lifecycle events are no longer supported. ` +
      `Use Composition API to dynamically register lifecycle hooks.`,
    link: `https://v3.vuejs.org/api/composition-api.html#lifecycle-hooks`
  },

  [DeprecationTypes.INSTANCE_CHILDREN]: {
    message:
      `vm.$children has been removed. Consider refactoring your logic ` +
      `to avoid relying on direct access to child components.`,
    link: `https://v3.vuejs.org/guide/migration/children.html`
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
  },

  [DeprecationTypes.V_ON_KEYCODE_MODIFIER]: {
    message:
      `Using keyCode as v-on modifier is no longer supported. ` +
      `Use kebab-case key name modifiers instead.`,
    link: `https://v3.vuejs.org/guide/migration/keycode-modifiers.html`
  }
}

const hasWarned: Record<string, boolean> = {}

/**
 * @internal
 */
export function warnDeprecation(key: DeprecationTypes, ...args: any[]) {
  if (!__DEV__) {
    return
  }

  // check user config
  const config = getCompatConfig(key)
  if (config && config.warning === false) {
    return
  }

  // avoid spamming the same message
  const dupKey = key + args.join('')
  if (hasWarned[dupKey]) {
    return
  }

  hasWarned[dupKey] = true
  const { message, link } = deprecationMessages[key]
  warn(
    `(DEPRECATION ${key}) ${
      typeof message === 'function' ? message(...args) : message
    }${link ? `\n  Details: ${link}` : ``}`
  )
}
