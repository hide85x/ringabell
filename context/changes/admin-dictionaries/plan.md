---
change_id: admin-dictionaries
title: Admin dictionaries — role types and fight requirements defaults
status: planned
created: 2026-06-01
updated: 2026-06-01
---

## Overview

Dodanie słowników administracyjnych:
1. **Typy ról osób** (`person_roles`) — np. Bokser, Trener, Sędzia, Lekarz
2. **Domyślne wymagania walki** (`fight_requirement_defaults`) — ile osób danej roli potrzeba przy każdej walce (globalny template)
3. **Admin nawigacja** — wspólny komponent header/sidebar z linkami do /admin/users i /admin/dictionaries
4. **Design system** — skewed buttons, hard 0-1 transitions na WSZYSTKICH stronach (index.vue, users.vue, dictionaries.vue)

---

## Phase 1: DB schema — migracja i modele

### Overview

Dodanie dwóch nowych tabel do D1: `person_roles` i `fight_requirement_defaults`. Nowa migracja SQL. Modele TypeScript.

### Changes Required

- `migrations/0002_dictionaries.sql` — CREATE TABLE person_roles, fight_requirement_defaults + unikalne indeksy
- `server/models/personRole.ts` — interfejs PersonRole
- `server/models/fightRequirementDefault.ts` — interfejs FightRequirementDefault

### Success Criteria

#### Automated
- `npx wrangler d1 migrations apply ringabell --local` przechodzi bez błędów
- `npx wrangler d1 execute ringabell --local --command "SELECT name FROM sqlite_master WHERE type='table'"` zwraca person_roles i fight_requirement_defaults

#### Manual
- Tabele widoczne w lokalnej bazie

---

## Phase 2: API — CRUD dla słowników

### Overview

8 endpointów REST pod `/api/admin/dictionaries/`. Wszystkie chronione przez `requireAdmin(event)`. Role mają blokadę usunięcia jeśli użyte w tabeli persons (409). Wymagania cascade DELETE przy usunięciu roli.

### Changes Required

**Roles:**
- `server/api/admin/dictionaries/roles/index.get.ts` — GET all roles
- `server/api/admin/dictionaries/roles/index.post.ts` — POST create role (name unique)
- `server/api/admin/dictionaries/roles/[id].patch.ts` — PATCH update name
- `server/api/admin/dictionaries/roles/[id].delete.ts` — DELETE (409 if used in persons table)

**Requirements:**
- `server/api/admin/dictionaries/requirements/index.get.ts` — GET all (JOIN z person_roles dla nazwy)
- `server/api/admin/dictionaries/requirements/index.post.ts` — POST create (role_id + count)
- `server/api/admin/dictionaries/requirements/[id].patch.ts` — PATCH update count
- `server/api/admin/dictionaries/requirements/[id].delete.ts` — DELETE

### Success Criteria

#### Automated
- `npx wrangler dev --port 3000` startuje bez błędów TypeScript

#### Manual
- GET /api/admin/dictionaries/roles zwraca []
- POST /api/admin/dictionaries/roles z `{ name: "Bokser" }` zwraca 201
- DELETE roli używanej w persons zwraca 409
- GET /api/admin/dictionaries/requirements zwraca requirements z nazwą roli

---

## Phase 3: UI — strona słowników + design system + nawigacja admin

### Overview

Strona `/admin/dictionaries` z sekcjami ról i wymagań. Komponent `AdminNav`. Design system z mockupu (Persona 5-style) zastosowany na WSZYSTKICH stronach: `index.vue`, `users.vue`, `dictionaries.vue`. Update `roadmap.md`.

### Changes Required

**Nowe pliki:**
- `app/components/AdminNav.vue` — pasek u góry z logo RINGABELL + linki USERS / DICTIONARIES
- `app/pages/admin/dictionaries.vue` — strona słowników

**Modyfikacje:**
- `app/pages/index.vue` — design system update
- `app/pages/admin/users.vue` — zastąpienie back-btn przez AdminNav, design system update

**Dokumentacja:**
- `context/foundation/roadmap.md` — S-01 i S-02 → status: implemented

### UI Design System (z analizy mockupu)

**Kolory i tło:**
- Strony: `background: #221010` (dark maroon-black)
- Akcent: `#f20d0d` (czerwony)
- Tekst: `white`

**Skew — zasada ogólna:**
- Elementy interaktywne (buttony, linki, badge'e sekcji, tagi ról): `transform: skewX(-8deg)`
- Na hover: odwrotny kierunek `transform: skewX(8deg)` — hard switch, bez ease
- Modalne header: `transform: skewX(-4deg)` (subtelniej)
- `transition: none` wszędzie — ZERO ease, ZERO duration

**Offset box-shadow — kluczowy efekt z mocku:**
- Karty/sekcje/modale: `border: 2px solid white; box-shadow: 4px 4px 0px white`
- Badges numeryczne (np. liczba wymagań): `border: 2px solid #f20d0d; box-shadow: 3px 3px 0px #f20d0d`
- Aktywny nav link: `box-shadow: 3px 3px 0px white`

**Modalne:**
- Overlay: `background: rgba(0,0,0,0.75)`
- Modal box: `background: #1a0808; border: 3px solid white; box-shadow: 6px 6px 0px white`
- Modal header: `background: #f20d0d`, bold italic uppercase, lekko skewed (`skewX(-4deg)`)
- Przyciski w footer modala: zapisz (red fill), anuluj/usuń (red outline) — oba skewed

**Elementy listy / tabeli:**
- Lewa krawędź wiersza: `border-left: 3px solid #f20d0d` jako dekorator (pionowy czerwony pasek)
- Row hover: `background: rgba(242, 13, 13, 0.1)` — hard switch (`transition: none`)
- Nagłówki kolumn: uppercase, letter-spacing, `background: #f20d0d`

**Sekcje / akordeony:**
- Nagłówek sekcji: bold italic badge na czerwonym tle, skewed (`skewX(-8deg)`), `box-shadow: 4px 4px 0px white`
- Przycisk `+` po prawej: skewed, border white, hover odwraca skew

**AdminNav:**
- Logo "RINGABELL" — italic bold, skewed, `color: #f20d0d`
- Linki USERS / DICTIONARIES — uppercase, border: `2px solid rgba(255,255,255,0.3)`, skewed
- Aktywny link: `border-color: white; box-shadow: 3px 3px 0px white`
- Hover: hard switch (`transition: none`), odwraca skew

**Dictionaries page — struktura:**
- Sekcja 1: "ROLE" badge + tabela (NAZWA | WYMAGANIE | akcje) + button DODAJ ROLĘ
- Sekcja 2: "WYMAGANIA WALK" badge + tabela (ROLA | LICZBA | akcje) + button DODAJ WYMAGANIE
- Liczba wymagań w tabeli ról: badge numeryczny z czerwonym offset shadow
- Inline delete z confirm, inline edit przez modal (ten sam styl co users.vue)

### Success Criteria

#### Automated
- Build (`npm run build`) przechodzi bez błędów

#### Manual
- /admin/dictionaries otwiera się bez błędów
- Można dodać rolę, dodać wymaganie do roli
- AdminNav widoczny na /admin/users i /admin/dictionaries
- Hover na buttonach/linkach: hard skew flip (bez ease)
- Modalne mają offset box-shadow i skewed header
- roadmap.md zaktualizowany

---

## Progress

### Phase 1: DB schema — migracja i modele
#### Automated
- [x] 1.1 Apply migration 0002_dictionaries.sql locally
- [x] 1.2 Verify tables in sqlite_master

#### Manual
- [x] 1.3 Tables visible in local DB

### Phase 2: API — CRUD dla słowników
#### Automated
- [ ] 2.1 roles index.get.ts
- [ ] 2.2 roles index.post.ts
- [ ] 2.3 roles [id].patch.ts
- [ ] 2.4 roles [id].delete.ts (409 guard)
- [ ] 2.5 requirements index.get.ts
- [ ] 2.6 requirements index.post.ts
- [ ] 2.7 requirements [id].patch.ts
- [ ] 2.8 requirements [id].delete.ts
- [ ] 2.9 wrangler dev starts clean

#### Manual
- [ ] 2.10 GET roles returns []
- [ ] 2.11 POST + DELETE with 409 guard works

### Phase 3: UI — strona słowników + design system + nawigacja admin
#### Automated
- [ ] 3.1 AdminNav.vue created
- [ ] 3.2 admin/dictionaries.vue created
- [ ] 3.3 index.vue design system applied
- [ ] 3.4 users.vue AdminNav + design polish
- [ ] 3.5 roadmap.md updated
- [ ] 3.6 npm run build passes

#### Manual
- [ ] 3.7 /admin/dictionaries — add role, add requirement
- [ ] 3.8 AdminNav visible on users + dictionaries
- [ ] 3.9 Skewed buttons hard hover on all pages
