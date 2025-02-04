import { describe, expect, test } from 'bun:test'
import * as T from '@sinclair/typebox/type'
import { printSchema } from 'graphql'
import { AltTransform } from '../alt-transform.ts'
import { empty } from '../typebox-graphql.ts'
import { FieldWithArgs, ID, Interface, Object } from '../types.ts'

const DateFromString = AltTransform(T.String(), T.Date(), {
  decode: (s: string) => new Date(s),
  encode: (d: Date) => d.toISOString(),
  $id: `DateFromString`,
})

const Likeable = Interface(`Likeable`, {
  likes: T.Integer(),
})

const User = Object(
  `User`,
  {
    id: ID(),
    createdAt: DateFromString,
    email: T.String(),
    subscribers: T.Array(T.String()),
  },
  { extends: [Likeable] },
)

const UpdateUserPayload = T.Object(
  {
    email: T.String(),
  },
  { $id: `UpdateUserPayload` },
)

const Query = T.Object({
  getUser: FieldWithArgs(User, { id: ID() }),
})

const Mutation = T.Object({
  updateUser: FieldWithArgs(User, { id: ID(), payload: UpdateUserPayload }),
})

describe(`Schema compilation`, () => {
  test(`it works`, () => {
    const reg = empty().addType(User).setQuery(Query).setMutation(Mutation)

    const schema = reg.compile()
    expect(printSchema(schema)).toMatchSnapshot()
  })
})
