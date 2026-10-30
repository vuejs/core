import { type UrlWithStringQuery, parse as uriParse } from 'url'
import path from 'path'
import { isString } from '@vue/shared'

export function isRelativeUrl(url: string): boolean {
  const firstChar = url.charAt(0)
  return (
    firstChar === '.' ||
    firstChar === '~' ||
    firstChar === '@' ||
    firstChar === '#'
  )
}

const externalRE = /^(?:https?:)?\/\//
export function isExternalUrl(url: string): boolean {
  return externalRE.test(url)
}

const dataUrlRE = /^\s*data:/i
export function isDataUrl(url: string): boolean {
  return dataUrlRE.test(url)
}

export function normalizeDecodedImportPath(source: string): string {
  try {
    return decodeURIComponent(source)
  } catch {
    return source
  }
}

/**
 * Parses string url into URL object.
 */
export function parseUrl(url: string): UrlWithStringQuery {
  const firstChar = url.charAt(0)
  if (firstChar === '~') {
    const secondChar = url.charAt(1)
    url = url.slice(secondChar === '/' ? 2 : 1)
  }
  return parseUriParts(url)
}

/**
 * vuejs/component-compiler-utils#22 Support uri fragment in transformed require
 * @param urlString - an url as a string
 */
function parseUriParts(urlString: string): UrlWithStringQuery {
  // A TypeError is thrown if urlString is not a string
  // @see https://nodejs.org/api/url.html#url_url_parse_urlstring_parsequerystring_slashesdenotehost
  return uriParse(isString(urlString) ? urlString : '', false, true)
}

export function joinUrl(
  base: UrlWithStringQuery,
  url: string,
  basePath: string = base.pathname || '/',
): string {
  const protocol = base.protocol || ''
  const host = base.host ? protocol + '//' + base.host : ''
  const suffixIndex = url.search(/[?#]/)
  const pathname = suffixIndex < 0 ? url : url.slice(0, suffixIndex)
  const suffix = suffixIndex < 0 ? '' : url.slice(suffixIndex)

  // Only normalize the pathname, preserving the query and hash.
  // The browser build provides a posix-only path polyfill.
  return host + (path.posix || path).join(basePath, pathname) + suffix
}
