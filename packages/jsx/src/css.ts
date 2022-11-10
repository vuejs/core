import * as CSS from 'csstype'

export interface CSSProperties
  extends CSS.Properties<string | number>,
    CSS.PropertiesHyphen<string | number> {
  /**
   * The index signature was removed to enable closed typing for style
   * using CSSType. You're able to use type assertion or module augmentation
   * to add properties or an index signature of your own.
   *
   * For examples and more information, visit:
   * https://github.com/frenic/csstype#what-should-i-do-when-i-get-type-errors
   */
  [v: `--${string}`]: string | number | undefined
}

// Vue's style normalization supports nested arrays
export type StyleValue = string | CSSProperties | Array<StyleValue>
