import { track, trigger } from './effect'
import { OperationTypes } from './operations'
import { isObject } from '@vue/shared'
import { observable } from './index'

export const knownValues = new WeakSet()

export interface Value<T> {
  value: T
}

type UnwrapValue<T, U = T> = T extends Value<infer V> ? V : T extends {} ? U : T

// A utility type that recursively unwraps value bindings nested inside an
// observable object. Unfortunately TS cannot do recursive types, but this
// should be enough for practical use cases...
export type UnwrapBindings<T> = {
  [key in keyof T]: UnwrapValue<
    T[key],
    {
      [k2 in keyof T[key]]: UnwrapValue<
        T[key][k2],
        {
          [k3 in keyof T[key][k2]]: UnwrapValue<
            T[key][k2][k3],
            {
              [k4 in keyof T[key][k2][k3]]: UnwrapValue<
                T[key][k2][k3][k4],
                {
                  [k5 in keyof T[key][k2][k3][k4]]: UnwrapValue<
                    T[key][k2][k3][k4][k5],
                    {
                      [k6 in keyof T[key][k2][k3][k4][k5]]: UnwrapValue<
                        T[key][k2][k3][k4][k5][k6],
                        {
                          [k7 in keyof T[key][k2][k3][k4][k5][k6]]: UnwrapValue<
                            T[key][k2][k3][k4][k5][k6][k7],
                            {
                              [k8 in keyof T[key][k2][k3][k4][k5][k6][k7]]: UnwrapValue<
                                T[key][k2][k3][k4][k5][k6][k7][k8],
                                {
                                  [k9 in keyof T[key][k2][k3][k4][k5][k6][k7][k8]]: UnwrapValue<
                                    T[key][k2][k3][k4][k5][k6][k7][k8][k9],
                                    {
                                      [k10 in keyof T[key][k2][k3][k4][k5][k6][k7][k8][k9]]: UnwrapValue<
                                        T[key][k2][k3][k4][k5][k6][k7][k8][k9][k10]
                                      >
                                    }
                                  >
                                }
                              >
                            }
                          >
                        }
                      >
                    }
                  >
                }
              >
            }
          >
        }
      >
    }
  >
}

const convert = (val: any): any => (isObject(val) ? observable(val) : val)

export function value<T>(raw: T): Value<T> {
  raw = convert(raw)
  const v = {
    get value() {
      track(v, OperationTypes.GET, '')
      return raw
    },
    set value(newVal) {
      raw = convert(newVal)
      trigger(v, OperationTypes.SET, '')
    }
  }
  knownValues.add(v)
  return v
}

export function isValue(v: any): boolean {
  return knownValues.has(v)
}
