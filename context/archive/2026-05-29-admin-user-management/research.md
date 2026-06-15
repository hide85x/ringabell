---
date: 2026-05-31T00:00:00+00:00
researcher: claude-sonnet-4-6
git_commit: 695f431c02fc393dcfc312610d2be5cc41822861
branch: master
repository: ringabell
topic: "Opcje dodania email/hasło auth obok OAuth — możliwości i trade-offy na Cloudflare Workers"
tags: [research, auth, oauth, credentials, nuxt-auth-utils, cloudflare-workers, password-hashing]
status: complete
last_updated: 2026-05-31
last_updated_by: claude-sonnet-4-6
last_updated_note: "Added follow-up research: user registration/creation flow with credentials"
---

# Research: Opcje dodania email/hasło auth obok OAuth

**Date**: 2026-05-31
**Researcher**: claude-sonnet-4-6
**Git Commit**: 695f431c02fc393dcfc312610d2be5cc41822861
**Branch**: master
**Repository**: ringabell

## Research Question

Jak dodać logowanie email/hasło obok obecnego OAuth (Google), zachowując invite flow? Jakie są możliwości i trade-offy na Cloudflare Workers?

## Summary

nuxt-auth-utils **natywnie wspiera credentials** przez `hashPassword`/`verifyPassword` (scrypt via `@adonisjs/hash`). Projekt ma już `nodejs_compat` w `wrangler.toml`, co oznacza że `node:crypto.scrypt` powinien działać na CF Workers. Dodanie email/hasło jest techniczne proste — wymaga 3 plików + rozszerzenia modelu User — i rozwiązuje problem z testowaniem OAuth bez drugiego konta Google.

**Kluczowe ryzyko**: CPU limit na CF Workers free plan (50ms). Scrypt z domyślnym `cost: 16384` może go przekroczyć. Wymaga testu przez `wrangler dev` i ewentualnego obniżenia `cost`.

## Detailed Findings

### A. Aktualny auth setup

**Flow**: Invite-only OAuth. Admin pre-dodaje email do MongoDB → user loguje się przez Google → OAuth callback sprawdza findOne(email) → reject jeśli brak → setUserSession z rolą z DB.

Kluczowe pliki:
- [server/routes/auth/google.get.ts](../../../server/routes/auth/google.get.ts) — OAuth handler: findOne → updateOne (name/avatar) → setUserSession
- [server/models/user.ts](../../../server/models/user.ts) — `{ _id, email, name, avatar, role, createdAt }` — brak pola na hasło
- [server/utils/admin-guard.ts](../../../server/utils/admin-guard.ts) — `requireAdmin()` auto-importowany
- [app/types/auth.d.ts](../../../app/types/auth.d.ts) — rozszerza `#auth-utils` User interface
- [app/middleware/auth.global.ts](../../../app/middleware/auth.global.ts) — global guard: niezalogowani → `/`
- [app/middleware/admin.ts](../../../app/middleware/admin.ts) — admin guard: non-Admin → `/`

**Sesja**: httpOnly cookie via `setUserSession`. Na kliencie `useUserSession()` zwraca `{ loggedIn, user, clear }`. Zawiera: `{ email, name, avatar, role }`.

### B. nuxt-auth-utils credentials support

**Tak — wbudowane.** Biblioteka (v0.5.29) dostarcza 3 auto-importowane helpery:

```ts
// Dostępne w server/ bez importu
hashPassword(password: string): Promise<string>
verifyPassword(hash: string, password: string): Promise<boolean>
passwordNeedsReHash(hash: string): boolean
```

Źródło: `node_modules/nuxt-auth-utils/dist/runtime/server/utils/password.js`

Nie ma specjalnego handlera (jak `defineOAuthGoogleEventHandler`). Zamiast tego: piszesz zwykły `defineEventHandler` na `POST /api/auth/login`. To jest celowe — daje pełną kontrolę nad logiką.

Konfiguracja scrypt (opcjonalna w `nuxt.config.ts`):
```ts
auth: {
  hash: {
    scrypt: { cost: 8192, blockSize: 8, parallelization: 1, saltSize: 16, keyLength: 64 }
  }
}
```

### C. Password hashing na Cloudflare Workers

| Metoda | Działa na CF Workers? | Uwagi |
|---|---|---|
| `nuxt-auth-utils` scrypt | **TAK (z nodejs_compat)** | Już masz flagę w wrangler.toml |
| `bcrypt` native | NIE | C++ addons — nie działa |
| `bcryptjs` pure JS | TAK | Wolny, nie rekomendowany |
| Web Crypto PBKDF2 | TAK | Natywny CF, bez zależności, ale wymaga własnej impl. |
| `argon2` | NIE (bez WASM paczki) | Nie potrzebny |

**Flaga `nodejs_compat`** w `wrangler.toml` (linia 4) — polyfilluje `node:crypto` na CF Workers od 2023/2024. Obejmuje `scrypt` i `randomBytes` których używa `@adonisjs/hash`.

**Ryzyko CPU**: scrypt z `cost: 16384` (default) może przekroczyć 50ms limit na free tier. Recommended: `cost: 4096` lub `cost: 8192` dla Workers.

### D. Kontekst PRD i historyczne decyzje

PRD (`context/foundation/prd.md:112`) mówi: *"Logowanie przez social login (OAuth) — brak haseł przechowywanych w systemie."* To była decyzja projektowa, nie techniczna konieczność. Zmiana na "OAuth + credentials" jest backward-compatible z PRD jeśli zaktualizujemy założenia.

Roadmap: S-01 ma status `proposed`, F-01/F-02 są `ready`. Dodanie credentials auth wpływa na F-01 (auth-scaffold), nie na S-01 bezpośrednio.

## Opcje implementacji

### Opcja 1: Credentials login obok OAuth (REKOMENDOWANA)

**Co**: Admin ustawia hasło przy dodawaniu usera → user może się logować emailem/hasłem ALBO przez Google.

**Zakres zmian**:
1. `server/models/user.ts` — dodaj `passwordHash?: string`
2. `app/types/auth.d.ts` — brak zmian (sesja wygląda tak samo)
3. `server/api/admin/users/index.post.ts` — dodaj opcjonalne `password` w body, hashuj przez `hashPassword()`
4. `server/api/auth/login.post.ts` — nowy endpoint: findOne(email) → verifyPassword() → setUserSession()
5. `app/pages/index.vue` — dodaj formularz email/hasło obok przycisku Google

**Pros**:
- Rozwiązuje problem testowania bez drugiego konta Google
- Minimalny scope — 1 nowy endpoint, 1 zmiana w modelu
- `hashPassword`/`verifyPassword` już dostępne przez nuxt-auth-utils
- `nodejs_compat` już w `wrangler.toml`
- Sesja wygląda tak samo (OAuth i credentials dają identyczny user object)

**Cons**:
- Trzeba przetestować CPU limit scrypt na `wrangler dev`
- Admin musi zarządzać hasłami (brak reset flow — scope creep)
- Rozszerza PRD poza oryginalne założenia

**Test CPU limit** (przed implementacją):
```bash
wrangler dev
# curl POST /api/auth/login z dummy credentials
# wrangler tail | grep "cpu" — sprawdź ms
```

### Opcja 2: Tylko testowanie — tymczasowa modyfikacja w Atlas

**Co**: Nie dodawaj credentials. Do testowania scenariusza "nieznany email" — tymczasowo zmień email w Atlas, przetestuj, przywróć.

**Pros**: Zero kodu, zero ryzyka.
**Cons**: Ręczne, podatne na błędy (możesz zapomnieć przywrócić), nie rozwiązuje potrzeby długoterminowej.

### Opcja 3: Web Crypto PBKDF2 zamiast scrypt

**Co**: Własna implementacja `hashPassword`/`verifyPassword` na `crypto.subtle` (natywne API CF Workers).

**Pros**: Gwarantowane działanie na Workers bez CPU timeout ryzyka.
**Cons**: Więcej kodu, nie używa helpera z nuxt-auth-utils, algorytm słabszy niż scrypt.

**Kiedy używać**: Tylko jeśli Opcja 1 przekracza CPU limit podczas testów.

## Code References

- [server/routes/auth/google.get.ts](../../../server/routes/auth/google.get.ts) — OAuth handler (findOne → reject/update → session)
- [server/models/user.ts](../../../server/models/user.ts) — User interface (dodać `passwordHash?`)
- [server/api/admin/users/index.post.ts](../../../server/api/admin/users/index.post.ts) — invite endpoint (rozszerzyć o password)
- `node_modules/nuxt-auth-utils/dist/runtime/server/utils/password.js` — hashPassword/verifyPassword source
- `node_modules/@adonisjs/hash/build/chunk-7RS6HCBK.js:2-4` — import `node:crypto` (scrypt, randomBytes)
- `wrangler.toml:4` — flaga `nodejs_compat`

## Architecture Insights

1. **Sesja jest agnostyczna względem metody logowania** — `setUserSession` przyjmuje ten sam user object niezależnie czy logujesz przez OAuth czy credentials. Brak zmian w middleware.

2. **Invite flow zostaje** — credentials są addytywne. Admin nadal pre-dodaje email. Różnica: opcjonalnie podaje też hasło przy tworzeniu usera.

3. **Jeden endpoint logowania** — `POST /api/auth/login` obsługuje credentials. OAuth zostaje na `/auth/google`. Dwie ścieżki do tej samej sesji.

4. **Brak "register" dla usera** — user nie może sam się zarejestrować ani ustawić hasła. Admin tworzy konto z hasłem. To jest zgodne z invite-only filozofią projektu.

## Open Questions

1. **CPU limit scrypt**: Czy `cost: 4096` wystarczy bezpiecznie? Wymaga testu przez `wrangler dev` przed implementacją.
2. **Reset hasła**: Jeśli admin zapomni hasło — jak je zresetować? Scope poza tym slajdem, ale warto zanotować.
3. **PRD update**: Dodanie credentials zmienia założenie "brak haseł w systemie". Czy aktualizujemy PRD?
4. **Czy OAuth nadal potrzebny?** Jeśli credentials rozwiązują testowanie, czy warto utrzymywać obie metody produkcyjnie?

---

## Follow-up Research 2026-05-31 — Moduł rejestracji i tworzenia użytkownika z credentials

### Pytanie

Jak powinien wyglądać moduł rejestracji/tworzenia nowego użytkownika jeśli dodajemy credentials (email + hasło) — kto ustawia hasło i jak user je dostaje?

### Kluczowe odkrycia

**nuxt-auth-utils NIE oferuje invite token / magic link / reset flow.**
Biblioteka ma tylko: `hashPassword`, `verifyPassword`, `passwordNeedsReHash` + JWT utilities (`signJwt`, `verifyJwt` via `jose`). Każdy token flow trzeba zbudować samemu.

**Infrastruktura email**: `.env.example` ma `RESEND_API_KEY` (zakomentowane). Nodemailer jest **explicite wykluczony** — nie działa na CF Workers V8 isolates. Resend SDK (fetch-based) to wyznaczone rozwiązanie. Paczka `resend` nie jest jeszcze zainstalowana.

**Email w projekcie jest zaplanowany dopiero na S-05** (event-publish-and-email) — wysyłka personelowi przy publikacji gali. Nie jest to auth feature.

**PRD**: zero self-service registration. Invite-only. Brak emaila powitalnego w MVP.

### Aktualna implementacja user creation

`POST /api/admin/users` ([server/api/admin/users/index.post.ts](../../../server/api/admin/users/index.post.ts)):
- Przyjmuje `{ email, role }`
- Tworzy `{ email, role, name: '', avatar: '', createdAt }`
- **Brak pola hasła** — User model ([server/models/user.ts](../../../server/models/user.ts)) nie ma `passwordHash`

UI: invite modal w [app/pages/admin/users.vue:181-209](../../../app/pages/admin/users.vue) — pola: email + rola.

### Warianty tworzenia użytkownika z hasłem

#### Wariant A — Admin ustawia hasło przy invite (REKOMENDOWANY dla MVP)

**Flow**:
1. Admin wypełnia modal: email + rola + opcjonalne hasło
2. `POST /api/admin/users` → `hashPassword(password)` → zapisuje `passwordHash`
3. Admin komunikuje hasło out-of-band (Slack/telefon)
4. User loguje się przez `POST /api/auth/login` (email + hasło) LUB przez Google OAuth

**Zakres zmian**:
- `server/models/user.ts` → dodaj `passwordHash?: string`
- `server/api/admin/users/index.post.ts` → opcjonalne `password` w body
- `server/api/auth/login.post.ts` → nowy endpoint credentials
- `app/pages/admin/users.vue` → opcjonalne pole hasło w invite modal
- `app/pages/index.vue` → formularz credentials obok przycisku Google

**Pros**: Zero nowej infrastruktury. `hashPassword` dostępny z nuxt-auth-utils. `nodejs_compat` już w wrangler.toml. Sesja identyczna dla obu metod logowania. Odpowiedni dla zamkniętego systemu (małego zespołu).

**Cons**: Admin musi komunikować hasło out-of-band. Brak flow zmiany hasła przez usera (follow-up).

#### Wariant B — User ustawia hasło po pierwszym logowaniu OAuth

**Flow**:
1. Admin tworzy usera jak teraz (`{ email, role }`) — bez hasła
2. User loguje się przez Google (OAuth obowiązkowy przy pierwszym razie)
3. Po zalogowaniu: strona ustawień z formularzem "Ustaw hasło"
4. `POST /api/auth/set-password` → weryfikuje sesję → `hashPassword()` → zapisuje

**Zakres zmian**: jak Wariant A MINUS pole hasła w invite modal, PLUS nowa strona ustawień + endpoint `set-password`.

**Pros**: Elegancki — Google weryfikuje tożsamość, user sam ustala hasło. Admin nie zarządza hasłami.

**Cons**: Wymaga OAuth do bootstrapu. Nie rozwiązuje problemu testowania bez Google konta (jeśli to był cel).

#### Wariant C — Token invite (full onboarding, potrzebuje email)

**Flow**:
1. Admin tworzy usera → system generuje JWT invite token (`signJwt` z nuxt-auth-utils)
2. Token wysyłany emailem przez Resend API
3. User klika link → `/auth/accept-invite?token=...` → ustawia hasło
4. Token jednorazowy, wygasa po 7 dniach

**Zakres zmian**: jak Wariant A PLUS instalacja Resend SDK, email template, endpoint accept-invite, token storage w MongoDB.

**Pros**: Prawdziwy onboarding flow. User sam ustawia hasło. Bezpieczny (token jednorazowy).

**Cons**: Duży scope. Email infrastruktura jeszcze nie istnieje (S-05). `signJwt` dostępny ale wymaga klucza prywatnego w secrets.

### Rekomendacja

**Wariant A** dla obecnego etapu projektu:
- Cel to testowanie credentials lokalnie + mały zamknięty zespół
- Zero nowej infrastruktury email
- Scope minimalny — 5 plików
- Admin ustawiający hasło jest OK dla systemu zarządzania galami (nie aplikacja konsumencka)
- Wariant C zostawić na po S-05, gdy Resend już jest w projekcie

**Zmiana hasła przez usera** (follow-up do Wariantu A): dodać `POST /api/auth/change-password` + formularz w profilu. Scope osobny, nie blokuje MVP.

### Pliki do stworzenia/modyfikacji (Wariant A)

| Plik | Operacja | Zmiana |
|---|---|---|
| [server/models/user.ts](../../../server/models/user.ts) | modyfikacja | `passwordHash?: string` |
| [server/api/admin/users/index.post.ts](../../../server/api/admin/users/index.post.ts) | modyfikacja | opcjonalne `password` → `hashPassword()` |
| `server/api/auth/login.post.ts` | nowy | `verifyPassword()` → `setUserSession()` |
| [app/pages/admin/users.vue](../../../app/pages/admin/users.vue) | modyfikacja | pole hasło w invite modal (opcjonalne) |
| [app/pages/index.vue](../../../app/pages/index.vue) | modyfikacja | formularz credentials obok Google button |
