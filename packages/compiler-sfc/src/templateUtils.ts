import { UrlWithStringQuery, parse as uriParse } from 'url'
import { isString } from '@vue/shared'

export function isRelativeUrl(url: string): boolean {
  const firstChar = url.charAt(0)
  return firstChar === '.' || firstChar === '~' || firstChar === '@'
}

// We need an extra transform context API for injecting arbitrary import
// statements.
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
  return uriParse(isString(urlString) ? urlString : '')
}
