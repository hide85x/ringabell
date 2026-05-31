# admin-user-management Implementation Plan

## Overview

Admin zarządza kontami użytkowników i przypisuje role systemowe (Admin/Manager/Personel).

Kluczowy gap obecnego stanu: OAuth callback (`server/routes/auth/google.get.ts`) ustawia sesję z hardkodowaną rolą `'Personel'` bez zapisu do MongoDB — brak miejsca gdzie zmiana roli przez Admina mogłaby się zapisać. Phase 1 naprawia ten fundament: każdy login upsertuje użytkownika w MongoDB, rola ładowana z bazy.

Reszta slice'a: trzy API routes za server-side `requireAdmin` guardem, client middleware blokujący `/admin/*` dla non-Admin, strona `/admin/users` w Persona 5 stylu (tabela + modal).

## Current State Analysis

- `server/routes/auth/google.get.ts:3-9` — `setUserSession` z hardkodowaną `role: 'Personel'`. Brak zapisu do MongoDB. Rola nie jest persistowana między sesjami.
- `server/models/user.ts` — interfejs `User` i `USERS_COLLECTION` gotowe, nigdy nie używane do zapisu.
- `server/utils/db.ts` — `getDb()` auto-importowany w server/. Pattern: `const config = useRuntimeConfig(event); getDb({ mongodbUri: config.mongodbUri })`.
- `app/middleware/auth.global.ts` — sprawdza tylko `loggedIn`, brak sprawdzania roli.
- Brak `server/api/` — żadne API routes nie istnieją.
- Brak `app/pages/` — żadnych stron nie ma poza `app/app.vue`.
- Brak server-side role check helper.

## Desired End State

- OAuth callback sprawdza czy email istnieje w MongoDB — jeśli nie, odmawia logowania (redirect do `/` z błędem).
- Admin może dodać użytkownika przez email z poziomu `/admin/users` — opcjonalnie ustawia hasło przy tworzeniu.
- Po zalogowaniu: name i avatar uzupełniane z Google, rola ładowana z bazy do sesji.
- `GET /api/admin/users` — lista wszystkich użytkowników (Admin only, 403 dla innych).
- `POST /api/admin/users` — dodanie nowego użytkownika przez email + opcjonalne hasło (Admin only).
- `PATCH /api/admin/users/:id` — zmiana roli (Admin only).
- `DELETE /api/admin/users/:id` — usunięcie użytkownika (Admin only, hard delete).
- `POST /api/auth/login` — logowanie przez email + hasło (credentials), dostępne dla każdego.
- `/admin/users` — strona z tabelą + modalem edycji + formularzem dodawania, niedostępna dla non-Admin.
- Strona główna (`/`) — formularz credentials obok przycisku Google; inline error przy złych danych.
- Bootstrap pierwszego Admina: ręczne wstawienie dokumentu `{ email, role: 'Admin', name: '', avatar: '', createdAt: now }` w MongoDB Atlas console + ustawienie hasła przez POST /api/admin/users albo bezpośrednio w Atlas.

### Key Discoveries

- `server/utils/db.ts:getDb` — auto-importowany; wzorzec wywołania przez `useRuntimeConfig(event)`.
- `server/routes/auth/google.get.ts` — jedyne miejsce ustawiania sesji; tu ląduje zmiana Phase 1.
- Nitro auto-imports: `requireUserSession`, `setUserSession`, `defineOAuthGoogleEventHandler` — dostępne bez explicit import w server/ context.
- `server/utils/` są auto-importowane — `requireAdmin` helper wyląduje tam i będzie dostępny globalnie.
- Persona 5 styl: `#221010` tło, `#f20d0d` czerwień, `Space Grotesk`, bold borders, offset drop-shadow `4px 4px 0px #fff`.
- Brak Tailwind w projekcie — UI przez `<style scoped>` w `.vue`.

## What We're NOT Doing

- Brak invite emaili (link z tokenem) — Admin dodaje email i opcjonalnie hasło, komunikuje out-of-band.
- Brak search/filter w tym slice'ie.
- Brak soft-delete — hard delete (PRD §FR-001 akceptuje lukę w obsadzie przyszłej gali).
- Brak cascade delete przypisań — osobny slice S-04.
- Brak ADMIN_EMAIL env var bootstrap — manual Atlas console.
- Brak admin reset/change hasła dla istniejącego usera — osobna faza w przyszłości.
- Brak "zmień hasło" dla zalogowanego usera — osobna faza.
- Brak walidacji siły hasła (min. długość, znaki specjalne) — nie w tym scope.

## Critical Implementation Details

**OAuth upsert pattern:**
`findOneAndUpdate({ email }, { $setOnInsert: { role: 'Personel', createdAt: new Date(nowUtc()) }, $set: { name, avatar } }, { upsert: true, returnDocument: 'after' })` — `$setOnInsert` gwarantuje że nowy user dostaje `role: 'Personel'`, powracający user zachowuje swoją rolę. Wartość `nowUtc()` opakowana w `new Date()` — `nowUtc()` jest źródłem UTC timestamp, `new Date()` wymagany przez typ `createdAt: Date` w modelu.

**requireAdmin helper** w `server/utils/admin-guard.ts` (auto-importowany):
`requireUserSession(event)` + check `role !== 'Admin'` + `throw createError({ statusCode: 403 })`. Każdy admin API handler wywołuje go jako pierwszą linię.

**PATCH role validation:** whitelist `['Admin', 'Manager', 'Personel']` — 400 jeśli nie jest w zbiorze.

**ObjectId:** `import { ObjectId } from 'mongodb'` — wymagany do `_id` lookup w PATCH/DELETE.

**Client admin middleware** (`app/middleware/admin.ts`) — nie jest global; deklarowany przez `definePageMeta({ middleware: 'admin' })` na stronie `/admin/users.vue`.

**UI — delete confirmation:** `window.confirm()` w modalu przed DELETE — minimalne, w zakresie slice'a.

---

## Phase 1: OAuth → MongoDB upsert + role persistence

### Overview

Zmiana chirurgiczna w `server/routes/auth/google.get.ts`: upsert user w MongoDB przy każdym logowaniu, załaduj rolę z bazy do sesji.

### Changes Required

#### 1. OAuth callback — upsert + load role

**File**: `server/routes/auth/google.get.ts`

**Intent**: Zastąpić hardkodowaną `role: 'Personel'` logiką: upsert dokumentu w MongoDB, załadować aktualną rolę do sesji.

**Contract**:
- Import explicit: `import { nowUtc } from '~~/utils/date'`
- Import explicit: `import type { User } from '~~/server/models/user'` oraz `import { USERS_COLLECTION } from '~~/server/models/user'`
- `getDb` i `useRuntimeConfig` auto-importowane (brak explicit import)
- Wewnątrz `onSuccess`: `const config = useRuntimeConfig(event)`, `const db = await getDb({ mongodbUri: config.mongodbUri })`
- `findOneAndUpdate` z opcjami `{ upsert: true, returnDocument: 'after' }`
- `$setOnInsert: { role: 'Personel' as const, createdAt: new Date(nowUtc()) }` — tylko dla nowych dokumentów
- `$set: { name: user.name, avatar: user.picture }` — aktualizowane przy każdym logowaniu
- `setUserSession(event, { user: { email: doc!.email, name: doc!.name, avatar: doc!.avatar, role: doc!.role } })`
- Sygnatura `onSuccess` i redirect do `/` bez zmian

---

### Success Criteria

#### Automated Verification

- `npm run build` przechodzi bez błędów TypeScript

#### Manual Verification

- Zaloguj się przez Google → sprawdź MongoDB Atlas → dokument z email, `role: 'Personel'`, `createdAt` pojawia się w kolekcji `users`
- Ponowny login → dokument istnieje, nie zduplikowany
- Ustaw ręcznie `role: 'Admin'` w Atlas → wyloguj → zaloguj → sesja zawiera `role: 'Admin'`

---

## Phase 2: Server API routes for admin

### Overview

Cztery pliki: guard helper + 3 API routes (list, patch, delete). Każda route wywołuje `requireAdmin` jako pierwszą linię.

### Changes Required

#### 1. requireAdmin guard helper

**File**: `server/utils/admin-guard.ts` (nowy plik)

**Intent**: Centralny guard dla wszystkich admin API routes — throw 403 jeśli sesja nie istnieje lub rola nie jest Admin.

**Contract**:
- `export async function requireAdmin(event: H3Event)` (`H3Event` z h3, Nitro global type)
- `const session = await requireUserSession(event)` (auto-import, nuxt-auth-utils)
- `if (session.user.role !== 'Admin') throw createError({ statusCode: 403, statusMessage: 'Forbidden' })`
- Zwraca `session` (caller może użyć danych sesji)
- Brak explicit imports (wszystko auto-importowane w server/utils/)

---

#### 2. GET /api/admin/users — lista użytkowników

**File**: `server/api/admin/users/index.get.ts` (nowy plik)

**Contract**:
- Pierwsza linia: `await requireAdmin(event)` (auto-import z server/utils/admin-guard.ts)
- `const config = useRuntimeConfig(event)`
- `const db = await getDb({ mongodbUri: config.mongodbUri })`
- `db.collection<User>(USERS_COLLECTION).find({}).toArray()`
- Zwraca tablicę dokumentów `User`
- Import explicit: `import type { User } from '~~/server/models/user'` i `import { USERS_COLLECTION } from '~~/server/models/user'`

---

#### 3. PATCH /api/admin/users/:id — zmiana roli

**File**: `server/api/admin/users/[id].patch.ts` (nowy plik)

**Contract**:
- Pierwsza linia: `await requireAdmin(event)`
- `const id = getRouterParam(event, 'id')`
- `const { role } = await readBody<{ role: string }>(event)`
- Whitelist validation: `const VALID_ROLES = ['Admin', 'Manager', 'Personel'] as const` — jeśli `role` nie jest w zbiorze → `throw createError({ statusCode: 400, statusMessage: 'Invalid role' })`
- `db.collection(USERS_COLLECTION).updateOne({ _id: new ObjectId(id) }, { $set: { role } })`
- Zwraca `{ ok: true }`
- Import explicit: `import { ObjectId } from 'mongodb'` i `USERS_COLLECTION` z `~~/server/models/user`

---

#### 4. DELETE /api/admin/users/:id

**File**: `server/api/admin/users/[id].delete.ts` (nowy plik)

**Contract**:
- Pierwsza linia: `await requireAdmin(event)`
- `db.collection(USERS_COLLECTION).deleteOne({ _id: new ObjectId(id) })`
- Zwraca `{ ok: true }`
- Import explicit: `import { ObjectId } from 'mongodb'` i `USERS_COLLECTION` z `~~/server/models/user`

---

### Success Criteria

#### Automated Verification

- `npm run build` przechodzi bez błędów TypeScript

#### Manual Verification

- `GET /api/admin/users` dla Admina → 200 z tablicą użytkowników
- `GET /api/admin/users` bez sesji / z rolą Personel → 401/403
- `PATCH /api/admin/users/:id` z `{ role: 'Manager' }` → 200 `{ ok: true }`, MongoDB zaktualizowane
- `PATCH /api/admin/users/:id` z `{ role: 'Nieznana' }` → 400
- `DELETE /api/admin/users/:id` → 200 `{ ok: true }`, dokument usunięty z kolekcji

---

## Phase 3: Client-side Admin UI

### Overview

Admin middleware (client) + strona `/admin/users` w Persona 5 stylu: dark background, tabela użytkowników, modal edycji roli i usunięcia.

### Changes Required

#### 1. Admin route middleware

**File**: `app/middleware/admin.ts` (nowy plik)

**Contract**:
- Sprawdza `user?.role === 'Admin'` przez `useUserSession()`
- Jeśli nie Admin: `return navigateTo('/')`
- Nie jest `.global` — deklarowany per-page przez `definePageMeta`

---

#### 2. Admin users page

**File**: `app/pages/admin/users.vue` (nowy plik)

**Contract**:
- `definePageMeta({ middleware: 'admin' })` — na górze script setup
- `useHead` ładuje Space Grotesk z Google Fonts
- Dane: `const { data: users, refresh } = await useFetch<User[]>('/api/admin/users')`
- Tabela: kolumny `name`, `email`, role badge (kolorowany), przycisk [EDIT]
- Klik [EDIT] → otwiera modal; `selectedUser` = kliknięty user
- Modal zawiera: name (tekst read-only), `<select>` z opcjami Admin/Manager/Personel (pre-selected), [SAVE] i [DELETE USER]
- `[SAVE]`: `$fetch('/api/admin/users/${selectedUser._id}', { method: 'PATCH', body: { role: selectedRole } })` → `refresh()` → zamknij modal
- `[DELETE USER]`: `window.confirm('Usuń użytkownika?')` → jeśli tak: `$fetch('/api/admin/users/${selectedUser._id}', { method: 'DELETE' })` → `refresh()` → zamknij modal
- `<style scoped>` z CSS:
  - tło body/page: `background: #221010`, `color: white`, `font-family: 'Space Grotesk', sans-serif`
  - tabela: `border: 2px solid #f20d0d`, `border-collapse: collapse`
  - wiersze: `border-bottom: 1px solid rgba(242,13,13,0.3)`, hover `background: rgba(242,13,13,0.1)`
  - role badge: `background: #f20d0d`, `color: white`, `font-weight: 800`, `text-transform: uppercase`
  - modal: `position: fixed`, `background: #1a0808`, `border: 3px solid white`, `box-shadow: 4px 4px 0px white`
  - przyciski: `background: #f20d0d`, `color: white`, `border: none`, `font-weight: 700`, `text-transform: uppercase`
  - DELETE button: `background: transparent`, `border: 2px solid #f20d0d`, `color: #f20d0d`

---

### Success Criteria

#### Automated Verification

- `npm run build` bez błędów TypeScript

#### Manual Verification

- `/admin/users` ładuje się dla Admina — tabela z listą użytkowników z MongoDB
- Klik [EDIT] → modal z aktualną rolą użytkownika
- Zmiana roli → [SAVE] → tabela odświeżona, nowa rola widoczna
- Wyloguj Admin → zaloguj Admin ponownie → rola Admin zachowana (z bazy)
- [DELETE USER] + potwierdzenie → użytkownik znika z tabeli
- Zaloguj jako non-Admin (Personel) → wejdź na `/admin/users` → redirect do `/`

---

## Phase 4: Invite flow — Admin dodaje userów, OAuth odrzuca nieznane emaile

### Overview

Zmiana bezpieczeństwa: OAuth callback przestaje akceptować każdy email Google — sprawdza czy email istnieje w MongoDB. Admin dostaje formularz dodawania użytkownika przez email w `/admin/users`.

### Changes Required

#### 1. OAuth callback — check-not-create

**File**: `server/routes/auth/google.get.ts`

**Intent**: Zastąpić upsert logiką: znajdź email w MongoDB, odmów jeśli nie ma.

**Contract**:
- `findOne({ email: user.email })` zamiast `findOneAndUpdate`
- Jeśli `doc === null` → `return sendRedirect(event, '/?error=unauthorized')`
- Jeśli znaleziony → `updateOne({ $set: { name: user.name, avatar: user.picture } })` → `setUserSession` z danymi z doc (role z bazy)
- Bootstrap: pierwsze konto musi być wstawione ręcznie do Atlas przed pierwszym logowaniem

---

#### 2. POST /api/admin/users — dodaj użytkownika przez email

**File**: `server/api/admin/users/index.post.ts` (nowy plik)

**Contract**:
- Pierwsza linia: `await requireAdmin(event)`
- `const { email, role } = await readBody<{ email: string; role: string }>(event)`
- Walidacja email: podstawowy format (zawiera `@`) — 400 jeśli brak
- Walidacja role: whitelist `['Admin', 'Manager', 'Personel']` — 400 jeśli nieznana
- Sprawdź duplikat: `findOne({ email })` → 409 jeśli już istnieje
- `insertOne({ email, role, name: '', avatar: '', createdAt: new Date(nowUtc()) })`
- Zwraca `{ ok: true }`
- Import explicit: `import { nowUtc } from '~~/utils/date'` i `USERS_COLLECTION` z `~~/server/models/user`

---

#### 3. UI — przycisk "DODAJ UŻYTKOWNIKA" + modal invite

**File**: `app/pages/admin/users.vue` (aktualizacja)

**Contract**:
- Przycisk `[DODAJ UŻYTKOWNIKA]` nad tabelą (styl Persona 5: border white, hover fill)
- Klik → otwiera modal invite z: pole email (`<input type="email">`), role select (default: Personel), [DODAJ] + [ANULUJ]
- `$fetch('/api/admin/users', { method: 'POST', body: { email, role } })` → `refresh()` → zamknij modal
- Obsługa błędu 409: "Ten email już istnieje w systemie"
- Nowo dodany user pojawia się w tabeli bez imienia i avatara (wypełni się po pierwszym logowaniu)

#### 4. Strona główna — komunikat o błędzie logowania

**File**: `app/pages/index.vue` (aktualizacja)

**Contract**:
- Odczytaj `?error=unauthorized` z query params (`useRoute().query.error`)
- Jeśli `error === 'unauthorized'` → wyświetl komunikat: "Twój email nie jest autoryzowany. Skontaktuj się z Administratorem."
- Komunikat w stylu Persona 5 (czerwone tło, bold)

---

### Success Criteria

#### Automated Verification

- `npm run build` bez błędów TypeScript

#### Manual Verification

- Admin dodaje nowy email przez formularz → pojawia się w tabeli
- Nowo dodany user loguje się przez Google → sesja ok, name/avatar uzupełnione
- Nieznany email próbuje się zalogować → redirect do `/?error=unauthorized` z komunikatem
- Duplikat emaila → 409, formularz pokazuje błąd

---

---

## Phase 5: Credentials backend

### Overview

Fundament credentials auth: konfiguracja scrypt, rozszerzenie modelu User o `passwordHash`, rozszerzenie endpoint invite o opcjonalne hasło, nowy endpoint logowania email+hasło.

### Changes Required

#### 1. Scrypt cost — konfiguracja

**File**: `nuxt.config.ts`

**Intent**: Obniżyć domyślny koszt scrypt z 16384 do 4096, żeby uniknąć CPU timeout na Cloudflare Workers (free tier limit: 50ms).

**Contract**: Dodaj klucz `auth` na tym samym poziomie co `runtimeConfig`:
```ts
auth: {
  hash: {
    scrypt: {
      cost: 4096,
    },
  },
},
```

---

#### 2. User model — passwordHash

**File**: `server/models/user.ts`

**Intent**: Dodać opcjonalne pole `passwordHash` do interfejsu User — przechowuje zahashowane hasło dla credentials login.

**Contract**: Dodaj `passwordHash?: string` do interfejsu `User`. Pole opcjonalne — użytkownicy bez hasła logują się tylko przez OAuth.

---

#### 3. POST /api/admin/users — opcjonalne hasło

**File**: `server/api/admin/users/index.post.ts`

**Intent**: Rozszerzyć endpoint invite o opcjonalne pole `password`. Jeśli podane — zahashuj przez `hashPassword()` i zapisz w dokumencie.

**Contract**:
- Rozszerz typ body: `readBody<{ email: string; role: string; password?: string }>(event)`
- Jeśli `password` jest niepustym stringiem: `const passwordHash = await hashPassword(password)`
- `insertOne` z `passwordHash` jeśli istnieje, bez jeśli nie podano
- `hashPassword` auto-importowane z nuxt-auth-utils — brak explicit import

---

#### 4. POST /api/auth/login — nowy endpoint

**File**: `server/api/auth/login.post.ts` (nowy plik)

**Intent**: Endpoint credentials login — weryfikuje email + hasło, tworzy sesję identyczną jak po OAuth.

**Contract**:
- Brak `requireAdmin` — dostępny dla każdego (niezalogowanego)
- `const { email, password } = await readBody<{ email: string; password: string }>(event)`
- Walidacja obecności obu pól — 400 jeśli brak
- `findOne({ email })` — jeśli `doc === null` lub `!doc.passwordHash` → `throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })`
- `const valid = await verifyPassword(doc.passwordHash, password)` — jeśli `false` → 401 "Invalid credentials"
- `await setUserSession(event, { user: { email: doc.email, name: doc.name, avatar: doc.avatar, role: doc.role } })`
- Zwraca `{ ok: true }` — klient robi `useUserSession().fetch()` po sukcesie
- Import explicit: `import type { User } from '~~/server/models/user'` i `USERS_COLLECTION` z `~~/server/models/user`
- `getDb`, `useRuntimeConfig`, `verifyPassword`, `setUserSession`, `createError` — auto-importowane

---

### Success Criteria

#### Automated Verification

- `npm run build` przechodzi bez błędów TypeScript

#### Manual Verification

- `curl -X POST /api/auth/login -d '{"email":"...", "password":"..."}'` z poprawnym email+hasłem → 200 `{ ok: true }`
- Jak wyżej z złym hasłem → 401
- Jak wyżej z emailem który nie ma passwordHash → 401
- `curl -X POST /api/admin/users -d '{"email":"...", "role":"Personel", "password":"test123"}'` → 200, MongoDB zawiera `passwordHash`
- `curl -X POST /api/admin/users -d '{"email":"...", "role":"Personel"}'` (bez hasła) → 200, MongoDB bez `passwordHash`

---

## Phase 6: Credentials UI

### Overview

Dwa zmiany w UI: pole hasło w invite modal na `/admin/users` + formularz credentials na stronie głównej z inline error handling.

### Changes Required

#### 1. Invite modal — opcjonalne pole hasło

**File**: `app/pages/admin/users.vue`

**Intent**: Dodać opcjonalne pole "HASŁO" do modalu "DODAJ UŻYTKOWNIKA". Pole puste = user może logować się tylko przez Google.

**Contract**:
- Nowy `ref`: `invitePassword = ref('')`
- W invite modal body: pole `<input type="password" v-model="invitePassword" class="text-input" placeholder="Opcjonalne">` pod select roli
- Label: `HASŁO (OPCJONALNE)`
- W `inviteUser()`: include `password: invitePassword.value || undefined` w body POST
- Po zamknięciu modalu: `invitePassword.value = ''` (reset)
- Style: identyczny jak `.text-input` — już zdefiniowany w `<style scoped>`

---

#### 2. Strona główna — formularz credentials

**File**: `app/pages/index.vue`

**Intent**: Dodać formularz email + hasło obok przycisku "Zaloguj przez Google". Inline error przy błędzie, `useUserSession().fetch()` po sukcesie.

**Contract**:
- Nowe refs: `loginEmail = ref('')`, `loginPassword = ref('')`, `loginError = ref('')`, `loginLoading = ref(false)`
- Nowa funkcja `async loginCredentials()`:
  - `loginError.value = ''`, `loginLoading.value = true`
  - `await $fetch('/api/auth/login', { method: 'POST', body: { email: loginEmail.value, password: loginPassword.value } })`
  - On success: `await useUserSession().fetch()` — odświeża session state reaktywnie
  - On error: `loginError.value = 'Nieprawidłowy email lub hasło.'`
  - `finally`: `loginLoading.value = false`
- Formularz widoczny tylko jeśli `!loggedIn.value`
- `<p v-if="loginError" class="error-banner">{{ loginError }}</p>` — pod formularzem
- Style Persona 5: input `background: #221010`, `border: 2px solid #f20d0d`, `color: white`, `font-family: 'Space Grotesk'`; submit button `background: #f20d0d`, `color: white`, `font-weight: 900`; separacja od Google button wizualnym dividerem "lub"

---

### Success Criteria

#### Automated Verification

- `npm run build` bez błędów TypeScript

#### Manual Verification

- Strona `/` wyświetla formularz email + hasło obok Google button (niezalogowany)
- Credentials login z poprawnym emailem + hasłem → sesja ok, user widoczny
- Credentials login z złym hasłem → inline error "Nieprawidłowy email lub hasło." (bez reload strony)
- Credentials login z emailem bez `passwordHash` → inline error
- `/admin/users` → modal DODAJ UŻYTKOWNIKA ma pole hasło (opcjonalne)
- Dodanie usera z hasłem → login przez credentials → sesja ok
- Dodanie usera bez hasła → login przez Google → sesja ok (invite flow bez zmian)

---

## References

- PRD: `context/foundation/prd.md` — FR-001, FR-002, Access Control
- Roadmap: `context/foundation/roadmap.md` — S-01
- OAuth handler: `server/routes/auth/google.get.ts`
- User model: `server/models/user.ts`
- DB utils: `server/utils/db.ts`
- Auth middleware: `app/middleware/auth.global.ts`
- Persona 5 style: `context/ui-mockups/stitch_p5_stylized_dashboard_v2/p5_stylized_dashboard_v2/code.html`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: OAuth → MongoDB upsert + role persistence

#### Automated

- [x] 1.1 npm run build przechodzi bez błędów TypeScript — b2a5af3

#### Manual

- [x] 1.2 Login przez Google → dokument w MongoDB z role: 'Personel', createdAt — b2a5af3
- [x] 1.3 Role ustawiona na 'Admin' w Atlas → kolejny login → sesja z role: 'Admin' — b2a5af3

### Phase 2: Server API routes for admin

#### Automated

- [x] 2.1 npm run build przechodzi bez błędów TypeScript — 695f431

#### Manual

- [x] 2.2 GET /api/admin/users → 200 dla Admina, 403 dla non-Admin — 695f431
- [x] 2.3 PATCH /api/admin/users/:id z poprawną rolą → 200, MongoDB zaktualizowane — 695f431
- [ ] 2.4 PATCH z nieprawidłową rolą → 400
- [x] 2.5 DELETE /api/admin/users/:id → 200, dokument usunięty

### Phase 3: Client-side Admin UI

#### Automated

- [x] 3.1 npm run build bez błędów TypeScript

#### Manual

- [ ] 3.2 /admin/users ładuje tabelę użytkowników dla Admina
- [x] 3.3 Modal edycji zapisuje rolę, tabela odświeżona
- [x] 3.4 Delete z potwierdzeniem usuwa użytkownika z listy
- [x] 3.5 Non-Admin przekierowany z /admin/users do /

### Phase 4: Invite flow — Admin dodaje userów, OAuth odrzuca nieznane emaile

#### Automated

- [x] 4.1 npm run build bez błędów TypeScript

#### Manual

- [ ] 4.2 Nieznany email próbuje się zalogować → redirect do /?error=unauthorized z komunikatem
- [ ] 4.3 Admin dodaje nowy email przez formularz → pojawia się w tabeli
- [ ] 4.4 Nowo dodany user loguje się przez Google → sesja ok, name/avatar uzupełnione
- [ ] 4.5 Duplikat emaila w formularzu → błąd 409

### Phase 5: Credentials backend

#### Automated

- [x] 5.1 npm run build przechodzi bez błędów TypeScript — e69cc07

#### Manual

- [x] 5.2 curl POST /api/auth/login z poprawnym email+hasłem → 200 { ok: true }
- [x] 5.3 curl POST /api/auth/login z złym hasłem → 401
- [x] 5.4 curl POST /api/auth/login z emailem bez passwordHash → 401
- [x] 5.5 curl POST /api/admin/users z password → MongoDB zawiera passwordHash
- [x] 5.6 curl POST /api/admin/users bez password → MongoDB bez passwordHash

### Phase 6: Credentials UI

#### Automated

- [x] 6.1 npm run build bez błędów TypeScript

#### Manual

- [x] 6.2 Strona / wyświetla formularz credentials obok Google button
- [x] 6.3 Login credentials z poprawnym hasłem → sesja ok, user widoczny
- [x] 6.4 Login credentials z złym hasłem → inline error (bez reload)
- [x] 6.5 Modal DODAJ UŻYTKOWNIKA ma pole hasło (opcjonalne)
- [x] 6.6 Dodanie usera z hasłem → login przez credentials → sesja ok
- [x] 6.7 Dodanie usera bez hasła → login przez Google → sesja ok
