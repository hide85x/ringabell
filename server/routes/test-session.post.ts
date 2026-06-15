const VALID_ROLES = ['Admin', 'Manager', 'Personel'] as const

export default defineEventHandler(async (event) => {
  const env = (event.context.cloudflare?.env as Record<string, string> | undefined)
  if (env?.NUXT_TEST_MODE !== '1') {
    throw createError({ statusCode: 404 })
  }

  const { role } = await readBody<{ role: string }>(event)

  if (!VALID_ROLES.includes(role as typeof VALID_ROLES[number])) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid role' })
  }

  const validRole = role as typeof VALID_ROLES[number]

  await setUserSession(event, {
    user: {
      email: `test-${role.toLowerCase()}@test.local`,
      name: role,
      avatar: '',
      role: validRole,
    },
  })

  return { ok: true }
})
