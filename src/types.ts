import * as T from '@sinclair/typebox/type'
import type { Simplify, UnionToIntersection } from 'type-fest'
import * as GraphQLKind from './kind.ts'

export type AddNameTag<T extends T.TProperties, Name extends string> = T & {
  _tag: T.TOptional<T.TLiteral<Name>>
}

export declare namespace GraphQL {
  namespace Utils {
    type InterfaceProps<I> = I extends Interface<infer N, infer P, infer E>
      ? P
      : // biome-ignore lint/complexity/noBannedTypes: <explanation>
        {}

    type ExtendInterface<I extends string> =
      | {
          [GraphQLKind.Interface]: I
        }
      | {
          [GraphQLKind.Object]: I
        }
  }

  interface Interface<
    Name extends string = string,
    T extends T.TProperties = T.TProperties,
    Ext extends string = string,
  > extends T.TObject<AddNameTag<T, Name>> {
    [GraphQLKind.Interface]: {
      name: Name
      extends: GraphQL.Interface[]
    }
  }

  interface Object<
    Name extends string = string,
    T extends T.TProperties = T.TProperties,
    Ext extends string = string,
  > extends T.TObject<AddNameTag<T, Name>> {
    [GraphQLKind.Object]: {
      name: Name
      extends: Ext[]
    }
  }

  interface Union<Name extends string, Elements extends Object | Interface>
    extends T.TUnion<Elements[]> {
    [GraphQLKind.Union]: {
      name: Name
      extends: Elements[]
    }
  }

  interface Enum<Name extends string, Elements extends string>
    extends T.TUnion<T.TLiteral<Elements>[]> {
    [GraphQLKind.Enum]: {
      name: Name
      values: T.TLiteral<Elements[number]>[]
    }
  }

  interface WithArgs<S extends T.TSchema, Args extends T.TProperties>
    extends T.TSchema {
    static: T.Static<S>
    [GraphQLKind.FieldWithArgs]: Args
  }

  interface ID extends T.TString {
    [GraphQLKind.ID]: GraphQLKind.Kind.ID
  }
}

const createSchema = (
  kind: GraphQLKind.Kind.Interface | GraphQLKind.Kind.Object,
) =>
  function (
    name: string,
    props: T.TProperties,
    options?: T.ObjectOptions & {
      extends?: GraphQL.Interface<string, T.TProperties>[]
    },
  ) {
    const interfacesProps = (options?.extends ?? []).reduce((acc, s) => {
      return Object.assign(acc, s.properties)
    }, {} as T.TProperties)

    return Object.assign(
      T.Object(
        Object.assign({}, props, interfacesProps, {
          _tag: T.Optional(T.Literal(name)),
        }),
        {
          ...options,
          $id: name,
        },
      ),
      {
        [kind]: { name, extends: options?.extends ?? [] },
      },
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    ) as any
  }

const GraphQLInterface: {
  <
    Name extends string,
    Props extends T.TProperties,
    Ext extends GraphQL.Interface<string, T.TProperties, string>,
  >(
    name: Name,
    props: Props,
    options: T.ObjectOptions & { extends: Ext[] },
  ): GraphQL.Interface<
    Name,
    [keyof Props] extends [never]
      ? Simplify<UnionToIntersection<GraphQL.Utils.InterfaceProps<Ext>>>
      : Simplify<
          UnionToIntersection<GraphQL.Utils.InterfaceProps<Ext>> & Props
        >,
    Ext[GraphQLKind.Kind.Interface]['name']
  >
  <Name extends string, Props extends T.TProperties>(
    name: Name,
    props: Props,
    options?: T.ObjectOptions,
  ): GraphQL.Interface<Name, Props, never>
} = createSchema(GraphQLKind.Interface)

export const IsInterface = (value: T.TSchema): value is GraphQL.Interface =>
  GraphQLKind.Interface in value

const GraphQLObject: {
  <
    Name extends string,
    Props extends T.TProperties,
    Ext extends GraphQL.Interface<string, T.TProperties, string>,
  >(
    name: Name,
    props: Props,
    options: T.ObjectOptions & { extends: Ext[] },
  ): GraphQL.Object<
    Name,
    [keyof Props] extends [never]
      ? Simplify<UnionToIntersection<GraphQL.Utils.InterfaceProps<Ext>>>
      : Simplify<
          UnionToIntersection<GraphQL.Utils.InterfaceProps<Ext>> & Props
        >,
    Ext[GraphQLKind.Kind.Interface]['name']
  >
  <Name extends string, Props extends T.TProperties>(
    name: Name,
    props: Props,
    options?: T.ObjectOptions,
  ): GraphQL.Object<Name, Props, never>
} = createSchema(GraphQLKind.Object)

export const IsObject = (value: T.TSchema): value is GraphQL.Object =>
  GraphQLKind.Object in value

const GraphQLUnion = <
  Name extends string,
  Elements extends GraphQL.Object | GraphQL.Interface,
>(
  name: Name,
  elements: Elements[],
  options?: T.SchemaOptions,
): GraphQL.Union<Name, Elements> =>
  Object.assign(
    T.Union(elements, {
      ...options,
      $id: name,
    }),
    {
      [GraphQLKind.Union]: { name },
    },
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  ) as any

export const IsUnion = (
  value: T.TSchema,
): value is GraphQL.Union<string, never> => GraphQLKind.Union in value

const GraphQLEnum = <Name extends string, Elements extends string>(
  name: string,
  elements: Elements[],
): GraphQL.Enum<Name, Elements> & { [key in Elements]: key } => {
  const elem = elements.map((e) => T.Literal(e))
  const union = T.Union(elem, {
    $id: name,
  })

  return Object.assign(union, {
    [GraphQLKind.Enum]: { name, values: union.elements },
    ...elements.reduce(
      (acc, e) => {
        acc[e] = e
        return acc
      },
      {} as { [key in Elements[number]]: Elements },
    ),
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  }) as any
}

export const GraphQLFieldWithArgs = <
  S extends T.TSchema,
  Args extends T.TProperties,
>(
  s: S,
  args: Args,
) => {
  return Object.assign(T.CloneType(s), {
    [GraphQLKind.FieldWithArgs]: args,
  }) as GraphQL.WithArgs<S, Args>
}

export const IsFieldWithArgs = (
  x: T.TSchema,
): x is GraphQL.WithArgs<T.TSchema, T.TProperties> => {
  return GraphQLKind.FieldWithArgs in x
}

export const ID = () => {
  return Object.assign(T.String(), {
    [GraphQLKind.ID]: GraphQLKind.ID,
  }) as GraphQL.ID
}

export const IsID = (value: T.TSchema): value is GraphQL.ID =>
  GraphQLKind.ID in value

export {
  GraphQLInterface as Interface,
  GraphQLObject as Object,
  GraphQLUnion as Union,
  GraphQLEnum as Enum,
  GraphQLFieldWithArgs as FieldWithArgs,
}
