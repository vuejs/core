export function injectHydrationHtml(html, ssrHtml, hydrationScript = '') {
  const appContainer = '<div id="app"></div>'

  if (!html.includes(appContainer)) {
    throw new Error('Missing empty #app container in client HTML')
  }

  const hydratedHtml = html.replace(
    appContainer,
    `<div id="app">${ssrHtml}</div>`,
  )

  if (!hydrationScript) {
    return hydratedHtml
  }

  return hydratedHtml.replace(
    '<script type="module"',
    `${hydrationScript}<script type="module"`,
  )
}
