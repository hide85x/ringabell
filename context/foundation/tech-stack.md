---
starter_id: nuxt
package_manager: npm
project_name: ringabell
hints:
  language_family: js
  team_size: solo
  deployment_target: vercel
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: verified
  path_taken: custom
  quality_override: false
  self_check_answers:
    typed: true
    from_official_starter: true
    conventions: true
    docs_current: false
    can_judge_agent: true
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
---

## Why this stack

Solo developer shipping a boxing event management web app (RingAbell) in 4 weeks with OAuth social login and transactional email. Custom path — the user has an explicit Vue/TypeScript preference and MongoDB familiarity, which directed away from the 10x-astro-starter React/Supabase recommendation at the opening choice. Nuxt is the only Vue full-stack option in the JS registry that clears all four quality gates (typed, convention-based, popular in training data, well-documented); bootstrapper confidence is verified. Nitro server routes satisfy the Node backend requirement, nuxt-auth-utils covers the OAuth social login required by PRD Access Control, and MongoDB is added via mongoose as a post-scaffold dependency — no registry card ships it by default but the add-on is well-trodden. Deployment to Vercel with GitHub Actions auto-deploy on merge matches the starter defaults and the solo timeline. Self-check returned 4/5 (docs_current not confirmed); single false is below the two-false Socratic threshold.
