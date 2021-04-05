export const enum DeprecationTypes {
  DOM_TEMPLATE_MOUNT,
  $MOUNT,
  $DESTROY
}

type DeprecationData = {
  message: string
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
      `vm.$mount() has been deprecated. ` +
      `Use createApp(RootComponent).mount() instead.`,
    link: `https://v3.vuejs.org/guide/migration/global-api.html#mounting-app-instance`
  },

  [DeprecationTypes.$DESTROY]: {
    message: `vm.$destroy() has been deprecated. Use app.unmount() instead.`,
    link: `https://v3.vuejs.org/api/application-api.html#unmount`
  }
}

export function warnDeprecation(key: DeprecationTypes) {
  const { message, link } = deprecations[key]
  console.warn(
    `[Deprecation]: ${message}${link ? `\nFor more details, see ${link}` : ``}`
  )
}
