/**
 * Set by `vaporInteropPlugin`. Stays false in apps that never import the
 * plugin, so bundlers drop the vapor-in-vdom branches of the renderer.
 */
export let isVaporInteropEnabled = false

/**
 * @internal
 */
export function setVaporInteropEnabled(): void {
  isVaporInteropEnabled = true
}
