export type Prettify<T> = { [K in keyof T]: T[K] } & {}

export type UnionToIntersection<U> = (
  U extends any ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never

// make keys required but keep undefined values
export type LooseRequired<T> = { [P in keyof (T & Required<T>)]: T[P] }

// If the type T accepts type "any", output type Y, otherwise output type N.
// https://stackoverflow.com/questions/49927523/disallow-call-with-any/49928360#49928360
export type IfAny<T, Y, N> = 0 extends 1 & T ? Y : N

export type Camelize<T extends string> =
  T extends `${infer FirstPart}-${infer SecondPart}`
    ? `${FirstPart}${Camelize<Capitalize<SecondPart>>}`
    : T

export type Hyphenate<T extends string> = Hyphenate_<Uncapitalize<T>>
type Hyphenate_<T extends string> =
  T extends `${infer FirstPart}${infer SecondPart}`
    ? FirstPart extends UpperCaseCharacters
      ? `-${Lowercase<FirstPart>}${Hyphenate_<SecondPart>}`
      : `${FirstPart}${Hyphenate_<SecondPart>}`
    : T

export type UpperCaseCharacters =
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'H'
  | 'I'
  | 'J'
  | 'K'
  | 'L'
  | 'M'
  | 'N'
  | 'O'
  | 'P'
  | 'Q'
  | 'R'
  | 'S'
  | 'T'
  | 'U'
  | 'V'
  | 'W'
  | 'X'
  | 'Y'
  | 'Z'
