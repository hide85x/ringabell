import { fileURLToPath } from 'node:url'

const mongoOptionalStub = fileURLToPath(
  new URL('./server/utils/mongo-optional-stubs', import.meta.url)
)

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['nuxt-auth-utils'],
  nitro: {
    preset: 'cloudflare-pages',
    // Stub optional MongoDB driver deps that aren't installed and aren't needed
    // for Atlas connections (AWS auth, GCP auth, compression, encryption, SOCKS proxy).
    alias: {
      'kerberos': mongoOptionalStub,
      '@mongodb-js/zstd': mongoOptionalStub,
      '@aws-sdk/credential-providers': mongoOptionalStub,
      'gcp-metadata': mongoOptionalStub,
      'snappy': mongoOptionalStub,
      'socks': mongoOptionalStub,
      'mongodb-client-encryption': mongoOptionalStub,
    }
  },
  runtimeConfig: {
    mongodbUri: ''
  }
})
