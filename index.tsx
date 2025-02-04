import './reset.d.ts'
import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { jsxRenderer } from 'hono/jsx-renderer'
import postgres from 'postgres'
import { createClient } from 'redis'
import Page from './jsx/Page.tsx'
import Controller from './lib/controller.tsx'
import { JwtService } from './lib/jwt.ts'
import { ProductsRepo } from './lib/repository/products.ts'
import { PurchasesRepo } from './lib/repository/purchases.ts'
import { UserRepo } from './lib/repository/user.ts'
import { EnvSchema } from './lib/schema.ts'
import type { AppEnv } from './lib/types.ts'

const env = EnvSchema.parse(process.env)

const pg = postgres(env.DATABASE_URL)
const redis = createClient({ url: env.REDIS_URL, database: 0 })

const userRepo = new UserRepo(pg, env)
const productsRepo = new ProductsRepo(redis, pg, env)
const purchasesRepo = new PurchasesRepo(productsRepo, pg, env)
const jwt = new JwtService(env.JWT_SECRET)

await redis.connect()

const server = new Hono<AppEnv>()
server
  .use(jsxRenderer(Page))
  .use(`*`, (ctx, next) => {
    const jwtString = ctx.req
      .header(`Cookie`)
      ?.split(`; `)
      .find((c) => c.startsWith(`auth=`))
    if (jwtString) {
      try {
        ctx.set(`jwt`, jwt.parse(jwtString.split(`auth=`)[1]))
      } catch (e) {
        ctx.header(`Set-Cookie`, `auth=; Path=/; Max-Age=0`)
      }
    }

    return next()
  })
  .use(`*`, (ctx, next) => {
    ctx.set(
      `ctrl`,
      new Controller(ctx, jwt, userRepo, productsRepo, purchasesRepo),
    )
    return next()
  })
  .get(`/static/*`, serveStatic({ root: `./public` }))
  .get(`/register`, (ctx) => ctx.var.ctrl.registration())
  .post(`/register`, (ctx) => ctx.var.ctrl.registrationSubmit())
  .get(`/login`, (ctx) => ctx.var.ctrl.login())
  .post(`/login`, (ctx) => ctx.var.ctrl.submitLogin())
  .get(`/`, (ctx) => ctx.var.ctrl.home())
  .post(`/purchase`, (ctx) => ctx.var.ctrl.checkout())
  .get(`/purchased`, (ctx) => ctx.var.ctrl.purchasedItems())
  .get(`/password-reset`, (ctx) => ctx.var.ctrl.passwordReset())
  .post(`/password-reset`, (ctx) => ctx.var.ctrl.beginPasswordReset())
  .get(`/change-password`, (ctx) => ctx.var.ctrl.changePassword())
  .post(`/change-password`, (ctx) => ctx.var.ctrl.finalizeChangePassword())

export default {
  port: 8080,
  fetch: server.fetch,
}
