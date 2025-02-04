export const Object: unique symbol = Symbol(
  '@amar4enko/typebox-graphql/symbols/ObjectKind',
)

export const Interface: unique symbol = Symbol(
  '@amar4enko/typebox-graphql/symbols/GraphQLInterfaceKind',
)

export const Union: unique symbol = Symbol(
  '@amar4enko/typebox-graphql/symbols/GraphQLUnionKind',
)

export const Enum: unique symbol = Symbol(
  '@amar4enko/typebox-graphql/symbols/GraphQLEnumKind',
)

export const FieldWithArgs: unique symbol = Symbol(
  '@amar4enko/typebox-graphql/symbols/FieldWithArgs',
)

export const ID: unique symbol = Symbol('@amar4enko/typebox-graphql/symbols/ID')

export declare namespace Kind {
  type Object = typeof Object
  type Interface = typeof Interface
  type Union = typeof Union
  type Enum = typeof Enum
  type FieldWithArgs = typeof FieldWithArgs
  type ID = typeof ID
}
