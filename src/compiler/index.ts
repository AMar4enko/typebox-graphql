import type { TObject, TSchema } from '@sinclair/typebox'
import {
  type TProperties,
  TransformKind,
  TypeGuard as tg,
} from '@sinclair/typebox/type'
/**
 * TypeBox schema to GraphQL input compiler
 */
import {
  GraphQLBoolean,
  GraphQLEnumType,
  type GraphQLFieldConfigArgumentMap,
  GraphQLFloat,
  GraphQLID,
  type GraphQLInputFieldConfig,
  GraphQLInputObjectType,
  type GraphQLInputType,
  GraphQLInt,
  GraphQLInterfaceType,
  GraphQLList,
  type GraphQLNamedInputType,
  type GraphQLNamedOutputType,
  type GraphQLNamedType,
  GraphQLNonNull,
  GraphQLObjectType,
  type GraphQLOutputType,
  GraphQLScalarType,
  GraphQLString,
  type ThunkObjMap,
  type GraphQLFieldConfig as _GraphQLFieldConfig,
} from 'graphql'
import type { ObjMap } from 'graphql/jsutils/ObjMap.js'
import {
  AltTransformKind,
  IsAltTransform,
  type TAltTransform,
} from '../alt-transform.ts'
import * as Kind from '../kind.ts'
import {
  type GraphQL,
  IsFieldWithArgs,
  IsID,
  IsInterface,
  IsObject,
} from '../types.ts'
import {
  MissingIdError,
  NotImplementedError,
  UseAltTransform,
} from './errors.ts'

export type GraphQLFieldConfig = _GraphQLFieldConfig<unknown, unknown>
export type GraphQLCommonType = GraphQLScalarType | GraphQLEnumType

export class SchemaReferenceStore<V> {
  protected idMap = new Map<string, V>()
  protected schemaMap = new WeakMap<TSchema, V>()

  get(id: string, s: TSchema, lookup: () => V) {
    if (this.idMap.has(id)) {
      return this.idMap.get(id)!
    }

    if (this.schemaMap.has(s)) {
      return this.schemaMap.get(s)!
    }

    const v = lookup()
    this.idMap.set(id, v)
    this.schemaMap.set(s, v)

    return v
  }

  all() {
    return [...this.idMap.values()]
  }
}

export class Compiler {
  protected ctx: unknown
  constructor(
    protected scalars = new SchemaReferenceStore<GraphQLScalarType>(),
    protected input = new SchemaReferenceStore<GraphQLNamedInputType>(),
    protected output = new SchemaReferenceStore<GraphQLNamedOutputType>(),
    protected interfaces = new SchemaReferenceStore<GraphQLInterfaceType>(),
  ) {}

  protected error(Error: new (s: TSchema, ctx: unknown) => Error, s: TSchema) {
    new Error(s, this.ctx)
  }

  protected withContext<A>(ctx: unknown, cb: () => A): A {
    const prevCtx = this.ctx
    this.ctx = ctx
    const res = cb()
    this.ctx = prevCtx

    return res
  }

  /**
   * Compiles userland scalar Schema
   */
  protected compileScalar(s: TAltTransform): GraphQLScalarType {
    const { $id } = s[AltTransformKind]
    if (!$id) {
      throw this.error(MissingIdError, s)
    }

    return this.scalars.get(
      $id,
      s,
      () =>
        new GraphQLScalarType({
          name: $id,
          description: s.description,
          // biome-ignore lint/suspicious/noExplicitAny: <explanation>
          serialize: s[TransformKind].Encode as any,
          // biome-ignore lint/suspicious/noExplicitAny: <explanation>
          parseValue: s[TransformKind].Decode as any,
        }),
    )
  }

  compileInputType(s: TObject): GraphQLNamedInputType {
    const id = s.$id
    if (!id) {
      throw this.error(MissingIdError, s)
    }

    const compile = () => {
      const { _tag, ...props } = s.properties

      const fields: ThunkObjMap<GraphQLInputFieldConfig> = () =>
        Object.entries(props).reduce(
          (acc, [name, schema]) => {
            acc[name] = {
              type: this.visitAsInputType(schema),
              defaultValue: schema.default,
              description: schema.description,
            }

            return acc
          },
          {} as ObjMap<GraphQLInputFieldConfig>,
        )

      /**
       * Explore @oneOf support
       */
      return new GraphQLInputObjectType({
        fields,
        name: id,
        description: s.description,
      })
    }

    return this.withContext(`Compiling input type ${id}`, () =>
      this.input.get(id, s, compile),
    )
  }

  public compilePropertiesAsArgs(
    p: TProperties,
  ): GraphQLFieldConfigArgumentMap {
    return Object.entries(p).reduce((acc, [name, schema]) => {
      acc[name] = {
        type: this.visitAsInputType(schema),
        defaultValue: schema.default,
        description: schema.description,
      }
      return acc
    }, {} as GraphQLFieldConfigArgumentMap)
  }

  protected compileFieldArgs(s: TSchema): GraphQLFieldConfigArgumentMap {
    return (
      IsFieldWithArgs(s) ? Object.entries(s[Kind.FieldWithArgs]) : []
    ).reduce((acc, [name, schema]) => {
      acc[name] = {
        type: this.visitAsInputType(schema),
        defaultValue: schema.default,
        description: schema.description,
      }
      return acc
    }, {} as GraphQLFieldConfigArgumentMap)
  }

  /**
   * Attempts to compile TypeBox schema as Scalar GraphQL type
   */
  protected compileGraphqlScalar(s: TSchema): GraphQLCommonType | void {
    switch (true) {
      /**
       * Transforms compile into Scalars
       * Though for it to work AltTransform must be used instead of regular Transform
       * to provide access to decoded schema
       */
      case tg.IsTransform(s):
        if (!IsAltTransform(s)) {
          throw this.error(UseAltTransform, s)
        }

        return this.compileScalar(s)
      /**
       * For an average schema, it's simple
       */
      case IsID(s):
        return GraphQLID
      case tg.IsInteger(s):
        return GraphQLInt
      case tg.IsString(s):
        return GraphQLString
      case tg.IsBoolean(s):
        return GraphQLBoolean
      case tg.IsNumber(s):
        return GraphQLFloat
    }
  }

  protected visitAsInputType(s: TSchema): GraphQLInputType {
    const compileInputSpecific = () => {
      switch (true) {
        case tg.IsObject(s):
          return this.compileInputType(s)
        case tg.IsArray(s):
          return new GraphQLList(this.visitAsInputType(s.items))
        default:
          throw new NotImplementedError(s, this.ctx)
      }
    }

    const t = this.compileGraphqlScalar(s) ?? compileInputSpecific()

    return tg.IsOptional(s) ? t : new GraphQLNonNull(t)
  }

  protected compileInterface(
    s: GraphQL.Interface<string, TProperties>,
  ): GraphQLInterfaceType {
    const id = s.$id
    if (!id) {
      throw this.error(MissingIdError, s)
    }

    const compile = () => {
      const interfaces = s[Kind.Interface].extends.map((s) =>
        this.compileInterface(s),
      )

      const { _tag, ...props } = s.properties

      const fields: ThunkObjMap<GraphQLFieldConfig> = () =>
        Object.entries(props).reduce(
          (acc, [name, schema]) => {
            acc[name] = {
              type: this.compileAsOutputType(schema),
              args: this.compileFieldArgs(schema),
              description: schema.description,
            }

            return acc
          },
          {} as ObjMap<GraphQLFieldConfig>,
        )

      /**
       * Explore @oneOf support
       */
      return new GraphQLInterfaceType({
        fields,
        name: id,
        interfaces,
        description: s.description,
      })
    }

    return this.withContext(`Compiling interface type ${id}`, () =>
      this.interfaces.get(id, s, compile),
    )
  }

  public compileOutputType(
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    s: GraphQL.Object<string, TProperties, any>,
  ): GraphQLNamedOutputType {
    const id = s.$id
    if (!id) {
      throw this.error(MissingIdError, s)
    }

    const compile = () => {
      const interfaces = s[Kind.Object].extends.map((s) =>
        this.compileInterface(s),
      )

      const { _tag, ...props } = s.properties

      const fields: ThunkObjMap<GraphQLFieldConfig> = () =>
        Object.entries(props).reduce(
          (acc, [name, schema]) => {
            acc[name] = {
              type: this.compileAsOutputType(schema),
              args: this.compileFieldArgs(schema),
              description: schema.description,
            }

            return acc
          },
          {} as ObjMap<GraphQLFieldConfig>,
        )

      /**
       * Explore @oneOf support
       */
      return new GraphQLObjectType({
        fields,
        name: id,
        interfaces,
        description: s.description,
      })
    }

    return this.withContext(`Compiling output object type ${id}`, () =>
      this.output.get(id, s, compile),
    )
  }

  public compileAsOutputType(s: TSchema): GraphQLOutputType {
    const compileOutputSpecific = () => {
      switch (true) {
        case IsInterface(s):
          return this.compileInterface(s)
        case IsObject(s):
          return this.compileOutputType(s)
        case tg.IsArray(s):
          return new GraphQLList(this.compileAsOutputType(s.items))
        default:
          throw new NotImplementedError(s, this.ctx)
      }
    }

    const t = this.compileGraphqlScalar(s) ?? compileOutputSpecific()

    return tg.IsOptional(s) ? t : new GraphQLNonNull(t)
  }

  public getNamedTypes(): GraphQLNamedType[] {
    return [
      ...this.scalars.all(),
      ...this.input.all(),
      ...this.output.all(),
      ...this.interfaces.all(),
    ]
  }
}
