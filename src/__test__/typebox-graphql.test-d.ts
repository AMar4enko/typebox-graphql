import { test } from 'bun:test'
import * as T from '@sinclair/typebox/type'
import { expectTypeOf } from 'expect-type'
import type { GraphQLResolveInfo } from 'graphql'
import { type SchemaRegistry, empty } from '../typebox-graphql.ts'
import {
  FieldWithArgs,
  type GraphQL,
  Interface,
  Object,
  Union,
} from '../types.ts'

const User = Object('User', {
  id: T.String(),
  email: T.String(),
  subscribers: T.Array(T.String()),
})

const Query = T.Object({
  getUser: User,
})

const Mutation = T.Object({
  updateUser: User,
})

type R = SchemaRegistry<{ User: typeof User }, typeof Query, typeof Mutation>

expectTypeOf<SchemaRegistry.UnresolvedKey<R>>().toEqualTypeOf<
  | `User.${'id' | 'email' | 'subscribers'}`
  | `Query.getUser`
  | `Mutation.updateUser`
>()

const Linkable = Interface('Linkable', {
  url: T.String(),
})

const Likeable = Interface('Likeable', {
  likes: T.Number(),
})

const Post = Object(
  'Post',
  {
    title: T.String(),
    content: T.String(),
  },
  { extends: [Linkable, Likeable] },
)

const Media = Object(
  'Media',
  {
    title: T.String(),
  },
  { extends: [Linkable] },
)

type ExtendsLinkable = SchemaRegistry.TypesExtendingInterface<
  typeof Post | typeof Media,
  'Linkable'
>

type ExtendsLikeable = SchemaRegistry.TypesExtendingInterface<
  typeof Post | typeof Media,
  'Likeable'
>

expectTypeOf<ExtendsLinkable>().toEqualTypeOf<typeof Media | typeof Post>()
expectTypeOf<ExtendsLikeable>().toEqualTypeOf<typeof Post>()

const InterfaceA = Interface('InterfaceA', {
  a: T.String(),
})

const InterfaceB = Interface(
  'InterfaceB',
  {
    b: T.String(),
  },
  { extends: [InterfaceA] },
)

const InterfaceC = Interface(
  'InterfaceC',
  {
    c: T.String(),
  },
  { extends: [InterfaceB] },
)

const InterfaceD = Interface('InterfaceD', {
  d: T.String(),
})

type Names<A> = A extends SchemaRegistry.GetInterfaceNames<infer Names>
  ? Names
  : never

const ObjB = Object(`ObjB`, {}, { extends: [InterfaceB] })
const ObjC = Object(`ObjC`, {})

const ObjA = Object(`ObjA`, {}, { extends: [InterfaceA] })

type UltimateTypeUnion = T.Static<
  SchemaRegistry.AllTypesExtendingInterface<
    | typeof InterfaceA
    | typeof InterfaceB
    | typeof InterfaceC
    | typeof InterfaceD
    | typeof ObjB
    | typeof ObjC
    | typeof ObjA,
    `InterfaceA`
  >
>

expectTypeOf<UltimateTypeUnion>().toEqualTypeOf<
  | {
      _tag?: `ObjA`
      a: string
    }
  | {
      _tag?: `ObjB`
      a: string
      b: string
    }
  | {
      _tag?: `InterfaceC`
      a: string
      b: string
      c: string
    }
  | {
      _tag?: `InterfaceB`
      a: string
      b: string
    }
>()

const ExpandObject = Object(`ExpandObject`, {
  a: T.String(),
  b: T.String(),
})

expectTypeOf<
  SchemaRegistry.ExpandedResultType<typeof ExpandObject, never>
>().toEqualTypeOf<{ _tag?: `ExpandObject`; a: string; b: string }>()

const ExpandObjectWithInterface = Object(`ExpandObject`, {
  intf: InterfaceA,
  b: T.String(),
  c: T.String(),
})

expectTypeOf<
  SchemaRegistry.ExpandedResultType<typeof ExpandObjectWithInterface, never>
>().toEqualTypeOf<{
  _tag?: `ExpandObject`
  b: string
  c: string
  intf: { _tag?: `InterfaceA`; a: string }
}>()

const Addressable = Interface('Addressable', { address: T.String() })

const Participant = Interface('Participant', {
  addresses: T.Array(Addressable),
  name: T.String(),
})

const VirtualAddress = Object(
  'VirtualAddress',
  { website: T.String() },
  { extends: [Addressable] },
)

const RealAddress = Object(
  'RealAddress',
  { postcode: T.String() },
  { extends: [Addressable] },
)

const Contact = Object(
  'Contact',
  {
    avatar: T.String(),
  },
  { extends: [Participant] },
)

const Customer = Object('Customer', {
  name: T.String(),
})

const Entity = Union('Entity', [Customer, Participant])

/**
 * Okay, this is where it gets a bit tricky
 * When expanding result type we must consider interface hierarchy
 * and unionize interfaces with it's derivatives, to allow for
 * proper type narrowing via _tag discriminated unions
 *
 * In the case below we may return either Participant object or full Contact object
 * both with addresses field, while addresses follow the same pattern
 */
type ExpectedTypeParticipant =
  | {
      _tag?: 'Participant' | undefined
      name: string
      addresses: (
        | {
            _tag?: 'Addressable' | undefined
            address: string
          }
        | {
            _tag?: 'VirtualAddress' | undefined
            website: string
            address: string
          }
        | {
            _tag?: 'RealAddress' | undefined
            postcode: string
            address: string
          }
      )[]
    }
  | {
      _tag?: 'Contact' | undefined
      name: string
      addresses: (
        | {
            _tag?: 'Addressable' | undefined
            address: string
          }
        | {
            _tag?: 'VirtualAddress' | undefined
            website: string
            address: string
          }
        | {
            _tag?: 'RealAddress' | undefined
            postcode: string
            address: string
          }
      )[]
      avatar: string
    }

type ExpandedTypeParticipant = SchemaRegistry.ExpandedResultType<
  typeof Participant,
  | typeof Addressable
  | typeof Participant
  | typeof VirtualAddress
  | typeof Contact
  | typeof RealAddress
  | typeof Customer
>

type ExpectedTypeEntity =
  | {
      _tag?: 'Participant' | undefined
      name: string
      addresses: (
        | {
            _tag?: 'Addressable' | undefined
            address: string
          }
        | {
            _tag?: 'VirtualAddress' | undefined
            address: string
            website: string
          }
        | {
            _tag?: 'RealAddress' | undefined
            address: string
            postcode: string
          }
      )[]
    }
  | {
      _tag?: 'Contact' | undefined
      name: string
      addresses: (
        | {
            _tag?: 'Addressable' | undefined
            address: string
          }
        | {
            _tag?: 'VirtualAddress' | undefined
            address: string
            website: string
          }
        | {
            _tag?: 'RealAddress' | undefined
            address: string
            postcode: string
          }
      )[]
      avatar: string
    }
  | {
      _tag?: 'Customer' | undefined
      name: string
    }

type ExpandedTypeEntity = SchemaRegistry.ExpandedResultType<
  typeof Entity,
  | typeof Addressable
  | typeof Participant
  | typeof VirtualAddress
  | typeof Contact
  | typeof RealAddress
  | typeof Customer
>

expectTypeOf<ExpandedTypeParticipant>().toEqualTypeOf<ExpectedTypeParticipant>()
expectTypeOf<ExpandedTypeEntity>().toEqualTypeOf<ExpectedTypeEntity>()

test(`resolve function`, () => {
  const User = Object('User', {
    id: T.String(),
    email: T.String(),
    subscribers: T.Array(T.String()),
  })

  const Query = T.Object({
    getUser: FieldWithArgs(User, { id: T.String() }),
  })

  const Mutation = T.Object({
    updateUser: User,
  })

  const reg = empty().addType(User).setQuery(Query).setMutation(Mutation)

  type GetUserResolver = SchemaRegistry.SchemaResolverFunction<
    typeof reg,
    'Query.getUser'
  >

  expectTypeOf<GetUserResolver>().toMatchTypeOf<
    (
      root: never,
      args: { id: string },
      ctx: never,
      info: GraphQLResolveInfo,
    ) =>
      | {
          _tag?: 'User' | undefined
          id: string
          email: string
          subscribers: string[]
        }
      | Promise<{
          _tag?: 'User' | undefined
          id: string
          email: string
          subscribers: string[]
        }>
  >()
})
