import { describe, expect, test } from 'bun:test'
import { useGraphQLSSE } from '@graphql-yoga/plugin-graphql-sse'
import * as T from '@sinclair/typebox/type'
import { serve } from 'bun'
import { printSchema } from 'graphql'
import { createClient } from 'graphql-sse'
import { type YogaServerInstance, createYoga } from 'graphql-yoga'
import { Hono } from 'hono'
import { createFactory } from 'hono/factory'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { AltTransform } from '../alt-transform.ts'
import { empty } from '../typebox-graphql.ts'
import { FieldWithArgs, ID, Interface, Object } from '../types.ts'

export const appFactory = createFactory()

// biome-ignore lint/complexity/noBannedTypes: <explanation>
const createYogaMiddleware = (yoga: YogaServerInstance<{}, {}>) =>
  appFactory.createHandlers(async (c) => {
    const { body, status, headers } = await yoga.fetch(c.req.raw, c)

    if (!body) {
      return c.body(null, 204)
    }

    return c.body(body, {
      status: status as ContentfulStatusCode,
      headers,
    })
  })

const DateFromString = AltTransform(T.String(), T.Date(), {
  decode: (s: string) => new Date(s),
  encode: (d: Date) => d.toISOString(),
  $id: `DateFromString`,
})

type A = T.Static<typeof DateFromString>

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

const Subscription = T.Object({
  userUpdates: FieldWithArgs(User, { id: ID() }),
})

const reg = empty()
  .addType(User)
  .setQuery(Query)
  .setMutation(Mutation)
  .setSubscription(Subscription)

describe(`Schema compilation`, () => {
  test(`it works`, () => {
    const schema = reg.compile()
    expect(printSchema(schema)).toMatchSnapshot()
  })
})

describe(`E2E`, () => {
  test(
    `works`,
    async () => {
      const schema = reg
        .resolve(`Query.getUser`, (root, args) => {
          return {
            _tag: `User`,
            id: args.id,
            createdAt: new Date(),
            email: `whatever@user.com`,
            likes: 0,
            subscribers: [],
          }
        })
        .compile()

      const yoga = createYoga({
        landingPage: true,
        schema,
        plugins: [useGraphQLSSE()],
      })

      const app = new Hono().all(
        `/graphql/stream`,
        ...createYogaMiddleware(yoga),
      )

      const server = serve({
        fetch(request, server) {
          if (request.headers.get('accept') === 'text/event-stream') {
            server.timeout(request, 3600)
          }

          return app.fetch(request)
        },
        port: 3000,
      })

      const client = createClient({
        url: 'http://localhost:3000/graphql/stream',
      })

      const resp = await client
        .iterate({
          query: `query { getUser(id: "1") { id createdAt email subscribers likes } }`,
        })
        .next()

      expect(resp.value.data.getUser).toMatchObject({
        id: expect.anything(),
        createdAt: new Date(),
        email: `whatever@user.com`,
        likes: 0,
        subscribers: [],
      })

      server.stop()
    },
    { timeout: 5_000 },
  )
})
