// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['nuxt-auth-utils'],
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
})
