import { describe, expect, test } from 'bun:test'
import * as P from '@sinclair/typebox/parser'
import * as T from '@sinclair/typebox/type'
import { Decode, Encode, IsNumber, IsString } from '@sinclair/typebox/value'
import { AltTransform, AltTransformKind } from '../alt-transform.ts'

describe(`AltTransform`, () => {
  test(`basic idea`, () => {
    const A = AltTransform(T.String(), T.Number(), {
      decode: (s: string) => parseFloat(s),
      encode: (n: number) => n.toString(),
    })

    const B = T.Object({
      a: A,
    })

    expect(T.TypeGuard.IsNumber(A[AltTransformKind])).toBe(true)

    expect(Decode(B, { a: '123' })).toEqual({ a: 123 })
    expect(Encode(B, { a: 123 })).toEqual({ a: `123` })
  })
})
