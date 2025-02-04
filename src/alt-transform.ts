/**
 * TypeBox Transform alternative, that captures
 * both side schemas, not only input side
 */

import type {
  SchemaOptions,
  TSchema,
  TTransform,
  TransformOptions,
} from '@sinclair/typebox'
import { Clone, CloneType, Transform } from '@sinclair/typebox/type'

import type { Static, StaticDecode } from '@sinclair/typebox'

export const AltTransformKind: unique symbol = Symbol(
  '@sinclair/typebox/symbols/AltTransformKind',
)

export interface TAltTransform<
  I extends TSchema = TSchema, // I stands for Schema on the input side
  A extends TSchema = TSchema, // A stands for Schema on the output side
> extends TTransform<I, Static<A>> {
  // static: TransformStatic<A, this['params']>
  [AltTransformKind]: I
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  [key: string]: any
}

export const AltTransform = <A extends TSchema, I extends TSchema>(
  from: I,
  to: A,
  options: {
    decode: (fromA: Static<I>) => Static<A>
    encode: (toA: Static<A>) => Static<I>
  } & SchemaOptions,
): TAltTransform<I, A> => {
  const { encode, decode, ...opts } = options
  const originalTransform = Transform(from)
    .Decode(options.decode)
    .Encode(options.encode)

  return Object.assign(originalTransform, {
    [AltTransformKind]: CloneType(to, opts),
  }) as unknown as TAltTransform<I, A>
}

export const IsAltTransform = (x: TSchema): x is TAltTransform => {
  return AltTransformKind in x
}
