import { UrlWithStringQuery, parse as uriParse } from 'url'
import { isString } from '@vue/shared'

export function isRelativeUrl(url: string): boolean {
  const firstChar = url.charAt(0)
  return firstChar === '.' || firstChar === '~' || firstChar === '@'
}

const externalRE = /^https?:\/\//
export function isExternalUrl(url: string): boolean {
  return externalRE.test(url)
}

const dataUrlRE = /^\s*data:/i
export function isDataUrl(url: string): boolean {
  return dataUrlRE.test(url)
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
 * @param urlString an url as a string
 */
function parseUriParts(urlString: string): UrlWithStringQuery {
  // A TypeError is thrown if urlString is not a string
  // @see https://nodejs.org/api/url.html#url_url_parse_urlstring_parsequerystring_slashesdenotehost
  return uriParse(isString(urlString) ? urlString : '', false, true)
}
