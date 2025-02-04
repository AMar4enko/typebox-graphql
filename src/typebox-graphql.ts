import * as T from '@sinclair/typebox'

import {
  type GraphQLFieldConfig,
  GraphQLObjectType,
  type GraphQLResolveInfo,
  GraphQLSchema,
} from 'graphql'
import { Compiler } from './compiler/index.ts'
import * as Kind from './kind.ts'
import { type GraphQL, IsFieldWithArgs } from './types.ts'

type ReadonlyOptionalPropertyKeys<T extends T.TProperties> = {
  [K in keyof T]: T[K] extends T.TReadonly<T.TSchema>
    ? T[K] extends T.TOptional<T[K]>
      ? K
      : never
    : never
}[keyof T]
type ReadonlyPropertyKeys<T extends T.TProperties> = {
  [K in keyof T]: T[K] extends T.TReadonly<T.TSchema>
    ? T[K] extends T.TOptional<T[K]>
      ? never
      : K
    : never
}[keyof T]
type OptionalPropertyKeys<T extends T.TProperties> = {
  [K in keyof T]: T[K] extends T.TOptional<T.TSchema>
    ? T[K] extends T.TReadonly<T[K]>
      ? never
      : K
    : never
}[keyof T]
type RequiredPropertyKeys<T extends T.TProperties> = keyof Omit<
  T,
  | ReadonlyOptionalPropertyKeys<T>
  | ReadonlyPropertyKeys<T>
  | OptionalPropertyKeys<T>
>

// prettier-ignore
type ObjectStaticProperties<
  T extends T.TProperties,
  R extends Record<PropertyKey, unknown>,
> = T.Evaluate<
  Readonly<Partial<Pick<R, ReadonlyOptionalPropertyKeys<T>>>> &
    Readonly<Pick<R, ReadonlyPropertyKeys<T>>> &
    Partial<Pick<R, OptionalPropertyKeys<T>>> &
    Required<Pick<R, RequiredPropertyKeys<T>>>
>

export declare namespace SchemaRegistry {
  type ResolvableType = GraphQL.Interface | GraphQL.Object

  type IsInterface<A> = A extends GraphQL.Interface
    ? A
    : A extends T.TArray<infer MaybeI extends GraphQL.Interface>
      ? MaybeI
      : never

  type AsString<T> = T extends string ? T : never

  type SafeKey<A> = [A] extends [never]
    ? never
    : keyof A extends string
      ? keyof A
      : never

  type TypeName<T extends ResolvableType> = T extends GraphQL.Interface<
    infer Name
  >
    ? Name
    : T extends GraphQL.Object<infer Name>
      ? Name
      : never

  /**
   * Creates union of all resolvable type properties
   * in <Name>.<PropertyName> format
   */
  type ResolvableTypeProperties<T extends ResolvableType> = T extends {
    properties: T.TProperties
  }
    ? `${AsString<TypeName<T>>}.${AsString<Exclude<keyof T['properties'], '_tag'>>}`
    : never

  type ResolverKeys<R> = R extends SchemaRegistry<
    infer Type,
    infer Query,
    infer Mutation,
    infer Subscription,
    infer Resolver
  >
    ?
        | ResolvableTypeProperties<Type[keyof Type]>
        | `Query.${Query extends T.TObject<T.TProperties> ? SafeKey<Query['properties']> : never}`
        | `Mutation.${Mutation extends T.TObject<T.TProperties> ? SafeKey<Mutation['properties']> : never}`
        | `Subscription.${Subscription extends T.TObject<T.TProperties> ? SafeKey<Subscription['properties']> : never}`
    : never

  /**
   * Creates union of all schema fields that are not yet resolved
   */
  type UnresolvedKey<R> = R extends SchemaRegistry<
    infer Type,
    infer Query,
    infer Mutation,
    infer Subscription,
    infer Resolver
  >
    ? Exclude<
        ResolverKeys<R>,
        [Resolver] extends [never] ? never : keyof Resolver
      >
    : never

  export type ObjectsExtendingInterface<
    Types extends ResolvableType,
    Needle extends string,
  > = Types extends GraphQL.Object<
    infer Name,
    infer Props,
    infer InterfaceNames
  >
    ? Needle extends InterfaceNames
      ? Types
      : never
    : never

  export type InterfacesExtendingInterface<
    Types extends ResolvableType,
    Needle extends string,
  > = Types extends GraphQL.Interface<
    infer Name,
    infer Props,
    infer InterfaceNames
  >
    ? Needle extends InterfaceNames
      ? Types
      : never
    : never

  export type GetInterfaceNames<Name extends string> =
    | GraphQL.Interface<Name, T.TProperties, string>
    | GraphQL.Object<Name, T.TProperties, string>

  export type TypesExtendingInterface<
    Types extends ResolvableType,
    Needle extends string,
    Acc = never,
  > =
    | Acc
    | ObjectsExtendingInterface<Types, Needle>
    | InterfacesExtendingInterface<Types, Needle>

  /**
   * Based on the registry state returns all types
   * extending a specific interface. Limited to 5 levels deep
   */
  type AllTypesExtendingInterface<
    RegisteredTypes extends ResolvableType,
    I extends string,
  > = TypesExtendingInterface<RegisteredTypes, I> extends infer Types
    ? Types extends GetInterfaceNames<infer Names>
      ? TypesExtendingInterface<
          RegisteredTypes,
          Names,
          Types
        > extends infer Types
        ? Types extends GetInterfaceNames<infer Names>
          ? TypesExtendingInterface<
              RegisteredTypes,
              Names,
              Types
            > extends infer Types
            ? Types extends GetInterfaceNames<infer Names>
              ? TypesExtendingInterface<
                  RegisteredTypes,
                  Names,
                  Types
                > extends infer Types
                ? Types extends GetInterfaceNames<infer Names>
                  ? TypesExtendingInterface<RegisteredTypes, Names, Types>
                  : never
                : never
              : never
            : never
          : never
        : never
      : never
    : never

  /**
   * Code below generates resolver function result type from schema
   * and registered types, deep expanding interfaces to possible arbitrary object
   * alternatives
   */

  /**
   * When expanding object we first check if any of it's properties
   * is GraphQL interface type, short circuiting to TypeBox Static if none
   */
  type ExpandObject<
    S,
    RegisteredTypes extends ResolvableType,
  > = S extends GraphQL.Object<infer Name, infer P, infer Extends>
    ? [IsInterface<S['properties'][keyof S['properties']]>] extends [never]
      ? T.Static<S>
      : ObjectStaticProperties<
          S['properties'],
          {
            [key in keyof S['properties']]: ExpandedResultType<
              S['properties'][key],
              RegisteredTypes
            >
          }
        >
    : never

  type ExpandInterface<
    S,
    RegisteredTypes extends ResolvableType,
  > = S extends GraphQL.Interface<infer Name, infer P, infer Extends>
    ?
        | ([IsInterface<S['properties'][keyof S['properties']]>] extends [never]
            ? T.Static<S>
            : ObjectStaticProperties<
                S['properties'],
                {
                  [key in keyof S['properties']]: ExpandedResultType<
                    S['properties'][key],
                    RegisteredTypes
                  >
                }
              >)
        | ExpandedResultType<
            AllTypesExtendingInterface<RegisteredTypes, Name>,
            RegisteredTypes
          >
    : never

  type ExpandArraySchema<
    S,
    RegisteredTypes extends ResolvableType,
  > = S extends T.TArray<infer E>
    ? ExpandedResultType<E, RegisteredTypes>[]
    : never

  type ExpandUnionSchema<
    S,
    RegisteredTypes extends ResolvableType,
  > = S extends T.TUnion<infer E>
    ? ExpandedResultType<E[number], RegisteredTypes>
    : never

  type ExpandedResultType<
    S extends T.TSchema,
    RegisteredTypes extends ResolvableType,
  > =
    | ExpandObject<S, RegisteredTypes>
    | ExpandInterface<S, RegisteredTypes>
    | ExpandUnionSchema<S, RegisteredTypes>
    | ExpandArraySchema<S, RegisteredTypes> extends infer A
    ? [A] extends [never]
      ? T.Static<S>
      : A
    : never

  type FieldArgs<S> = S extends GraphQL.WithArgs<
    infer _,
    infer Args extends T.TProperties
  >
    ? T.Static<T.TObject<Args>>
    : never

  type ResolverFunction<
    S extends T.TSchema,
    RegisteredTypes extends ResolvableType,
    Ctx = never,
    Root extends T.TObject = never,
  > = (
    root: [Root] extends [never] ? never : T.Static<Root>,
    args: FieldArgs<S>,
    ctx: Ctx,
    info: GraphQLResolveInfo,
  ) =>
    | ExpandedResultType<S, RegisteredTypes>
    | Promise<ExpandedResultType<S, RegisteredTypes>>

  type SchemaResolverFunction<R, Key extends UnresolvedKey<R>> = [R] extends [
    SchemaRegistry<
      infer Type,
      infer Query,
      infer Mutation,
      infer _Subscription,
      infer _Resolver,
      infer Ctx
    >,
  ]
    ? Key extends `${infer TypeName}.${infer FieldName}`
      ? [TypeName, FieldName] extends [
          SafeKey<Type>,
          SafeKey<Type[TypeName]['properties']>,
        ]
        ? ResolverFunction<
            Type[TypeName][FieldName],
            Type[keyof Type],
            Ctx,
            Type[TypeName]
          >
        : [TypeName, FieldName] extends [`Query`, SafeKey<Query['properties']>]
          ? ResolverFunction<
              Query['properties'][FieldName],
              Type[keyof Type],
              Ctx
            >
          : [TypeName, FieldName] extends [
                `Mutation`,
                SafeKey<Mutation['properties']>,
              ]
            ? ResolverFunction<
                Mutation['properties'][FieldName],
                Type[keyof Type],
                Ctx
              >
            : never
      : never
    : never
}

export interface SchemaRegistry<
  Type extends { [key in string]: GraphQL.Object } = never,
  Query extends T.TObject<{
    [name in string]: T.TSchema
  }> = never,
  Mutation extends T.TObject<{
    [name in string]: T.TSchema
  }> = never,
  Subscription extends T.TObject<{
    [name in string]: T.TSchema
  }> = never,
  Resolver extends { [key in string]: unknown } = never,
  // Unresolved extends { [key in string]: SchemaRegistry.CachedUnresolved } = never,
  Ctx = never,
> {
  readonly type: Map<string, GraphQL.Object>
  readonly query: Query
  readonly mutation: Mutation
  readonly subscription: Map<
    keyof Subscription,
    Subscription[keyof Subscription]
  >
  readonly resolver: Map<keyof Resolver, Resolver[keyof Resolver]>

  compile: () => GraphQLSchema

  addType: <S extends GraphQL.Object>(
    type: S,
  ) => SchemaRegistry<
    [Type] extends [never]
      ? { [key in SchemaRegistry.TypeName<S>]: S }
      : { [key in SchemaRegistry.TypeName<S>]: S } & Type,
    Query,
    Mutation,
    Subscription,
    Resolver,
    Ctx
  >

  setQuery: <S extends T.TObject>(
    query: S,
  ) => SchemaRegistry<Type, S, Mutation, Subscription, Resolver, Ctx>

  setMutation: <S extends T.TObject>(
    mutation: S,
  ) => SchemaRegistry<Type, Query, S, Subscription, Resolver, Ctx>

  setSubscription: <S extends T.TObject>(
    subscription: S,
  ) => SchemaRegistry<Type, Query, Mutation, S, Resolver, Ctx>

  resolve: <
    Key extends SchemaRegistry.UnresolvedKey<
      SchemaRegistry<Type, Query, Mutation, Subscription, Resolver>
    >,
  >(
    key: Key,
    resolverFn: SchemaRegistry.SchemaResolverFunction<
      SchemaRegistry<Type, Query, Mutation, Subscription, Resolver>,
      Key
    >,
  ) => SchemaRegistry<
    Type,
    Query,
    Mutation,
    Subscription,
    Resolver & { [id in Key]: typeof resolverFn },
    Ctx
  >
}

/**
 * @internal
 */

function addType(this: SchemaRegistry, type: T.TSchema) {
  return createProto({
    ...this,
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    type: new Map([...this.type, [type.$id, type]]) as any,
  })
}

/**
 * @internal
 */

function withOperation(operationType: `mutation` | `query` | `subscription`) {
  return function withOperation(this: SchemaRegistry, type: T.TObject) {
    return createProto({
      ...this,
      [operationType]: type,
    })
  }
}

function resolve(this: SchemaRegistry, key: string, resolverFn: unknown) {
  return createProto({
    ...this,
    resolver: new Map([...this.resolver, [key, resolverFn]]),
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  } as any)
}

function createProto(r: SchemaRegistry) {
  return Object.freeze(
    Object.assign(
      Object.create({
        addType,
        setQuery: withOperation(`query`),
        setMutation: withOperation(`mutation`),
        resolve,
        compile,
      }),
      r,
    ),
  )
}

export const empty = (): SchemaRegistry<never, never, never, never, never> => {
  const obj = createProto({
    type: new Map(),
    query: new Map(),
    mutation: new Map(),
    subscription: new Map(),
    resolver: new Map(),
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  } as any)

  Object.freeze(obj)

  return obj
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
function compile(this: SchemaRegistry<any, any, any, any, any, any>) {
  const c = new Compiler()
  this.type.values().map((a: GraphQL.Object) => c.compileOutputType(a))
  const queryObj: T.TObject<{ [key in string]: GraphQL.Object }> =
    this.query ?? T.Object({})

  const query = [
    ...Object.entries(queryObj.properties).map(
      ([key, type]: [string, GraphQL.Object]) => {
        return [
          key,
          {
            type: c.compileAsOutputType(type),
            args: IsFieldWithArgs(type)
              ? // @ts-ignore
                c.compilePropertiesAsArgs(type[Kind.FieldWithArgs])
              : {},
            description: type.description,
            resolve: this.resolver.get(`Query.${String(key)}`),
            // biome-ignore lint/suspicious/noExplicitAny: <explanation>
          } satisfies GraphQLFieldConfig<any, any, any>,
        ]
      },
    ),
  ]

  const mutationObj: T.TObject<{ [key in string]: GraphQL.Object }> =
    this.mutation ?? T.Object({})

  const mutation = [
    ...Object.entries(mutationObj.properties).map(([key, type]) => {
      return [
        key,
        {
          type: c.compileAsOutputType(type),
          args: IsFieldWithArgs(type)
            ? c.compilePropertiesAsArgs(type[Kind.FieldWithArgs])
            : {},
          description: type.description,
          resolve: this.resolver.get(`Mutation.${String(key)}`),
          // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        } satisfies GraphQLFieldConfig<any, any, any>,
      ]
    }),
  ]
  const types = c.getNamedTypes()
  return new GraphQLSchema({
    types,
    query:
      query.length > 0
        ? new GraphQLObjectType({
            name: `Query`,
            fields: Object.fromEntries([...query]),
          })
        : undefined,
    mutation:
      mutation.length > 0
        ? new GraphQLObjectType({
            name: `Mutation`,
            fields: Object.fromEntries([...mutation]),
          })
        : undefined,
  })
}
