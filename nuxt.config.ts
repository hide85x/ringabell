// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  app: {
    head: {
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
    },
  },
  modules: ['nuxt-auth-utils', '@nuxt/eslint'],
  nitro: {
    preset: 'cloudflare-module',
  },
  auth: {
    hash: {
      scrypt: {
        cost: 4096,
      },
    },
  },
  runtimeConfig: {
    session: {
      maxAge: 60 * 60 * 24,
    },
  },
})