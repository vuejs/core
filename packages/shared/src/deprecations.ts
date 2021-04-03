export const enum DeprecationTypes {
  DOM_TEMPLATE_MOUNT
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
  }
}

export function warnDeprecation(key: DeprecationTypes) {
  const { message, link } = deprecations[key]
  console.warn(
    `[Deprecation]: ${message}${link ? `\nFor more details, see ${link}` : ``}`
  )
}
