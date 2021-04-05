import { isRuntimeOnly } from '../component'

export const enum DeprecationTypes {
  DOM_TEMPLATE_MOUNT,
  $MOUNT,
  $DESTROY,

  CONFIG_SILENT,
  CONFIG_DEVTOOLS,
  CONFIG_KEY_CODES,
  CONFIG_PRODUCTION_TIP,
  CONFIG_IGNORED_ELEMENTS
}

type DeprecationData = {
  message: string | (() => string)
  link?: string
}

const deprecations: Record<DeprecationTypes, DeprecationData> = {
  [DeprecationTypes.DOM_TEMPLATE_MOUNT]: {
    message:
      `Vue detected directives on the mount container. ` +
      `In Vue 3, the container is no longer considered part of the template ` +
      `and will not be processed/replaced.`,
    link: `https://v3.vuejs.org/guide/migration/mount-changes.html`
  },

  [DeprecationTypes.$MOUNT]: {
    message:
      `vm.$mount() has been removed. ` +
      `Use createApp(RootComponent).mount() instead.`,
    link: `https://v3.vuejs.org/guide/migration/global-api.html#mounting-app-instance`
  },

  [DeprecationTypes.$DESTROY]: {
    message: `vm.$destroy() has been removed. Use app.unmount() instead.`,
    link: `https://v3.vuejs.org/api/application-api.html#unmount`
  },

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
  }
}

export function warnDeprecation(key: DeprecationTypes) {
  if (!__COMPAT__ || !__DEV__) {
    return
  }
  const { message, link } = deprecations[key]
  console.warn(
    `[Vue Deprecation]: ${typeof message === 'function' ? message() : message}${
      link ? `\nFor more details, see ${link}` : ``
    }`
  )
}
