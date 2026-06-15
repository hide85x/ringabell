# admin-user-management — Plan Brief

> Full plan: `context/changes/admin-user-management/plan.md`
> Research: `context/changes/admin-user-management/research.md`

## What & Why

Admin zarządza kontami użytkowników i przypisuje role (Admin/Manager/Personel). System jest invite-only — admin pre-dodaje email przed pierwszym logowaniem. Dodajemy credentials auth (email + hasło) obok Google OAuth, żeby rozwiązać problem testowania lokalnego bez drugiego konta Google.

## Starting Point

4 fazy już zaimplementowane (kod napisany, build przechodzi). OAuth → MongoDB → sesja działa. Invite flow (Admin dodaje email, OAuth odrzuca nieznane) jest napisane ale nie w pełni przetestowane ręcznie. Brak credentials w projekcie — tylko Google OAuth.

## Desired End State

Admin może dodać usera z opcjonalnym hasłem. User może logować się przez Google OAuth **lub** przez email + hasło na stronie głównej. Inline error przy złych credentials. Sesja identyczna dla obu metod — zero zmian w middleware/guardach.

## Key Decisions Made

| Decyzja | Wybór | Dlaczego | Źródło |
|---|---|---|---|
| Kto ustawia hasło | Admin przy invite | Brak emaila w projekcie (S-05); małe zamknięte środowisko | Research |
| Hasło przy invite | Opcjonalne | Elastyczność — OAuth-only userzy bez hasła | Plan |
| Scrypt cost | 4096 | CF Workers free tier 50ms CPU limit; default 16384 przekracza | Research |
| Błąd logowania | Inline error w formularzu | Lepsza UX niż redirect | Plan |
| Admin reset hasła | Poza scope | Minimalizacja scope; nie blokuje MVP | Plan |
| Refresh sesji po login | `useUserSession().fetch()` | Reaktywny update bez reload | Plan |

## Scope

**In scope:**
- `nuxt.config.ts` — scrypt cost: 4096
- `server/models/user.ts` — `passwordHash?: string`
- `server/api/admin/users/index.post.ts` — opcjonalne `password` → `hashPassword()`
- `server/api/auth/login.post.ts` — nowy endpoint credentials
- `app/pages/admin/users.vue` — opcjonalne pole hasła w invite modal
- `app/pages/index.vue` — formularz credentials + inline error

**Out of scope:**
- Admin reset/change hasła istniejącego usera
- Zmiana hasła przez zalogowanego usera
- Walidacja siły hasła
- Invite email z linkiem
- "Zapomniałem hasła" flow

## Architecture / Approach

Addytywna zmiana do istniejącej architektury. `hashPassword`/`verifyPassword` auto-importowane z nuxt-auth-utils (scrypt via `@adonisjs/hash`, działa z `nodejs_compat` już w `wrangler.toml`). Nowy endpoint `POST /api/auth/login` nie ma `requireAdmin` — dostępny publicznie. `setUserSession` daje identyczny cookie jak OAuth — cały stack middleware/guard jest niezmieniony.

```
POST /api/auth/login
  → findOne(email)
  → verifyPassword(passwordHash, password)
  → setUserSession({ email, name, avatar, role })
  → { ok: true }
  → klient: useUserSession().fetch()
```

## Phases at a Glance

| Faza | Co dostarcza | Kluczowe ryzyko |
|---|---|---|
| 1–4 (istniejące) | OAuth, API admin, UI tabela, invite flow | Nieprzetestowane ręcznie: 2.4, 2.5, 3.2–3.5, 4.2–4.5 |
| 5. Credentials backend | scrypt config + model + invite extend + login endpoint | CPU timeout scrypt (mitygowane cost: 4096) |
| 6. Credentials UI | Formularz login na `/` + pole hasła w invite modal | `useUserSession().fetch()` musi odświeżyć session reaktywnie |

**Prerequisites:** Fazy 1–4 kod napisany, build przechodzi. Ręczne testy faz 3–4 nadal do zrobienia — można robić równolegle po Phase 5/6.

## Open Risks & Assumptions

- `useUserSession().fetch()` musi być dostępne w nuxt-auth-utils v0.5.29 — weryfikacja przez `npm run dev` w Phase 6
- scrypt `cost: 4096` wystarczy dla CF Workers — weryfikacja przez `wrangler dev` przy manualnym teście Phase 5
- `hashPassword` jest auto-importowane w `server/api/` (nie tylko `server/utils/`) — potwierdzone przez research (Nitro auto-imports z nuxt-auth-utils)

## Success Criteria (Summary)

- `npm run build` przechodzi bez błędów (Phase 5 + 6)
- `POST /api/auth/login` zwraca sesję dla poprawnych credentials, 401 dla złych
- Formularz na `/` loguje przez credentials, inline error działa, sesja reaktywna
