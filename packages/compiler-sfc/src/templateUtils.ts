import { UrlWithStringQuery, parse as uriParse } from 'url'

// We need an extra transform context API for injecting arbitrary import
// statements.
export function parseUrl(url: string): UrlWithStringQuery {
  const firstChar = url.charAt(0)
  if (firstChar === '.' || firstChar === '~' || firstChar === '@') {
    if (firstChar === '~') {
      const secondChar = url.charAt(1)
      url = url.slice(secondChar === '/' ? 2 : 1)
    }
  }
  return parseUriParts(url)
}

/**
 * vuejs/component-compiler-utils#22 Support uri fragment in transformed require
 * @param urlString an url as a string
 */
function parseUriParts(urlString: string): UrlWithStringQuery {
  // initialize return value
  const returnValue: UrlWithStringQuery = uriParse('')
  if (urlString) {
    // A TypeError is thrown if urlString is not a string
    // @see https://nodejs.org/api/url.html#url_url_parse_urlstring_parsequerystring_slashesdenotehost
    if ('string' === typeof urlString) {
      // check is an uri
      return uriParse(urlString) // take apart the uri
    }
  }
  return returnValue
}
