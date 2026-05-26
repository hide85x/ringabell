---
deployed_at: 2026-05-26
platform: Cloudflare Pages
project_name: ringabell
deployment_id: cda7d6c5
status: success
---

## First Deploy — RingAbell scaffold

**URL**: https://ringabell-foe.pages.dev

### What was deployed

Nuxt 4 minimal scaffold (NuxtWelcome page) — no application logic yet. Goal: verify the deploy pipeline works before writing any business code.

### Steps executed

1. `wrangler login` — OAuth with Cloudflare account (lukasz.pelc@profitroom.com)
2. `npm run build` — Nitro build with `cloudflare-pages` preset
3. `npx wrangler pages project create ringabell` — project created in Cloudflare dashboard
4. `npx wrangler pages deploy dist --project-name ringabell` — Nitro z presetem `cloudflare-pages` buduje do `dist/` nie `.output/public/`; worker bundle uploaded, deploy complete

### Config changes made for this deploy

- `nuxt.config.ts` — added `nitro.preset: 'cloudflare-pages'`
- `wrangler.toml` — created with `name`, `compatibility_date`, `pages_build_output_dir`
- `package.json` — renamed from `bootstrap-scaffold` to `ringabell`
- `.env.example` — created with MongoDB, OAuth, Resend placeholders

### Next steps

- Wire GitHub → Cloudflare Pages for auto-deploy on push
- Configure env vars in Cloudflare dashboard when MongoDB Atlas is ready
- Replace NuxtWelcome with first real page
