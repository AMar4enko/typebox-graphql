import * as T from '@sinclair/typebox/type'
import { expectTypeOf } from 'expect-type'
import * as K from '../kind.ts'
import * as Types from '../types.ts'

const Addressable = Types.Interface('Addressable', { address: T.String() })
const Nameable = Types.Interface('Nameable', { name: T.String() })

expectTypeOf<T.Static<typeof Nameable>>().toEqualTypeOf<{
  _tag?: `Nameable`
  name: string
}>()

const Identifiable = Types.Interface(
  `Identifiable`,
  {},
  { extends: [Nameable, Addressable] },
)

expectTypeOf<typeof Identifiable>().toEqualTypeOf<
  Types.GraphQL.Interface<
    `Identifiable`,
    {
      name: T.TString
      address: T.TString
    },
    `Nameable` | `Addressable`
  >
>()

expectTypeOf<T.Static<typeof Identifiable>>().toEqualTypeOf<{
  _tag?: `Identifiable`
  name: string
  address: string
}>()

const Person = Types.Object(
  `Person`,
  {
    id: T.String(),
  },
  { extends: [Identifiable] },
)

expectTypeOf<typeof Person>().toEqualTypeOf<
  Types.GraphQL.Object<
    `Person`,
    {
      id: T.TString
      name: T.TString
      address: T.TString
    },
    `Identifiable`
  >
>()

expectTypeOf<T.Static<typeof Person>>().toEqualTypeOf<{
  _tag?: `Person`
  name: string
  address: string
  id: string
}>()

const Attachment = Types.Object(`Attachment`, {
  url: T.String(),
})

const PersonOrAttachment = Types.Union(`PersonOrAttachment`, [
  Person,
  Attachment,
])

expectTypeOf<T.Static<typeof PersonOrAttachment>>().toEqualTypeOf<
  | {
      _tag?: `Person`
      name: string
      address: string
      id: string
    }
  | {
      _tag?: `Attachment`
      url: string
    }
>()

const Status = Types.Enum(`Status`, [`ACTIVE`, `INACTIVE`])

expectTypeOf<T.Static<typeof Status>>().toEqualTypeOf<`ACTIVE` | `INACTIVE`>()

expectTypeOf<typeof Status.ACTIVE>().toMatchTypeOf<`ACTIVE`>()
expectTypeOf<typeof Status.INACTIVE>().toMatchTypeOf<`INACTIVE`>()
