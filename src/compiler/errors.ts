import type { TSchema } from '@sinclair/typebox'

export class MissingIdError extends Error {
  constructor(s: TSchema, context: unknown) {
    super(
      [context, `missing identifier in schema`, JSON.stringify(s, null, 2)]
        .filter(Boolean)
        .join(`\n`),
    )
  }
}

export class NotImplementedError extends Error {
  constructor(s: TSchema, context: unknown) {
    super(
      [context, `schema support is not implemented`, JSON.stringify(s, null, 2)]
        .filter(Boolean)
        .join(`\n`),
    )
  }
}

export class UseAltTransform extends Error {
  constructor(s: TSchema, context: unknown) {
    super(
      [
        context,
        `use AltTransform instead of Transform`,
        JSON.stringify(s, null, 2),
      ]
        .filter(Boolean)
        .join(`\n`),
    )
  }
}
