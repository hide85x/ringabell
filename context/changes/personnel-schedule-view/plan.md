# Personnel Schedule View — Implementation Plan

## Overview

Widok kalendarza dla zalogowanego personelu: lista wszystkich opublikowanych gal, do których jest przypisany (wszystkie — przeszłe i nadchodzące), z możliwością rozwinięcia szczegółów. Powiązanie User↔Person przez `persons.email = user.email` (Google OAuth). Widok jest read-only.

## Current State Analysis

- Brak jakichkolwiek stron i endpointów dla roli `Personel` — `app/pages/personel/` nie istnieje
- `app/middleware/manager.ts` przekierowuje `Personel` na `/`; brak middleware dla `/personel/*`
- `index.vue` pokazuje linki na podstawie roli: Admin/Manager mają przyciski, Personel nie ma nic
- Tabela `assignments` ma kolumny: `id, person_id, type ('fight'|'event'), fight_id, event_id, role`
- `persons.email` to jedyne pole łączące Person z zalogowanym użytkownikiem (brak FK `user_id`)
- Wzorce kodu: `server/utils/manager-guard.ts`, `server/api/manager/events/index.get.ts`, `app/components/ManagerNav.vue`

## Desired End State

- Po zalogowaniu Personel widzi przycisk "MOJE GALE →" na `index.vue`
- `/personel/schedule` pokazuje listę opublikowanych gal z datą, miejscem i rolą
- Kliknięcie gali otwiera panel szczegółów: event-level role + walki do których jest przypisany
- Empty state: "Nie masz jeszcze przypisanych gal" gdy brak przypisań lub brak rekordu Person
- Próba wejścia na `/personel/*` przez Admin/Manager przekierowuje na `/`

### Key Discoveries

- Wzorzec guard: `server/utils/manager-guard.ts:3-8` — skopiuj, zmień warunek na `role !== 'Personel'`
- Wzorzec listy: `server/api/manager/events/index.get.ts:1-15` — SELECT + GROUP BY + getD1
- Wzorzec strony: `app/pages/manager/events.vue` — `useFetch` + `$fetch` dla detali + modal pattern + lokalne `ref`
- Wzorzec nawiagacji: `app/components/ManagerNav.vue:1-113`
- Link User↔Person: tylko przez email match — brak `user_id` w tabeli `persons`
- D1 binding: `getD1(event)` z `server/utils/db.ts`

## What We're NOT Doing

- Brak Auto-redirect po logowaniu (zostawiamy button pattern z index.vue)
- Brak filtrowania/wyszukiwania gal
- Brak S-05 (emaile) — osobny slice, nie prerequisite
- Brak dostępu Admin/Manager do widoku `/personel/*`
- Brak paginacji — zakładamy że personel nie ma setek gal

## Implementation Approach

Trzy fazy: API layer (guard + 2 endpointy) → Frontend (middleware + nav + strona + patch index.vue) → Testy (RBAC + integration). Wzorce kopiowane 1:1 z istniejących plików managerskich — różnica tylko w SQL (email match zamiast bez filtru) i w warunku guard (Personel zamiast Manager/Admin).

## Critical Implementation Details

**SQL dla listy** — GROUP_CONCAT po stronie DB, żeby nie robić N+1 queries. Assignments łączy się z events przez dwa ścieżki (`type='event'` i `type='fight'`):

```sql
SELECT
  e.id, e.name, e.date, e.venue, e.status, e.created_at AS createdAt,
  GROUP_CONCAT(DISTINCT a.role) AS roles
FROM events e
JOIN assignments a ON (
  (a.type = 'event' AND a.event_id = e.id)
  OR
  (a.type = 'fight' AND a.fight_id IN (SELECT id FROM fights WHERE event_id = e.id))
)
JOIN persons p ON p.id = a.person_id
WHERE p.email = ? AND e.status = 'published'
GROUP BY e.id
ORDER BY e.date ASC
```

`roles` to string z GROUP_CONCAT (`"Sędzia,Lekarz"`) — split po przecinku w API response handlerze, zwróć jako `string[]`.

**Brak rekordu Person** — jeśli `persons.email` nie pasuje do żadnego rekordu, zapytania zwrócą puste wyniki. Nie rzucaj błędu — zwróć pustą tablicę. Personel zobaczy empty state.

**Detail endpoint — autoryzacja przez data** — przed zwróceniem detalu zweryfikuj że osoba jest przypisana do tego eventu (podzapytanie lub sprawdź że `fightAssignments.length + eventRoles.length > 0`). Jeśli nie — 404.

---

## Phase 1: API Layer

### Overview

Nowy guard `requirePersonel` + dwa endpointy: lista gal personelu i szczegóły jednej gali.

### Changes Required

#### 1. Guard dla personelu

**File**: `server/utils/personel-guard.ts`

**Intent**: Weryfikuje że zalogowany użytkownik ma rolę `Personel`. Zwraca sesję (z `session.user.email`) do użycia w query.

**Contract**: Eksportuje `requirePersonel(event: H3Event): Promise<UserSession>`. Rzuca 403 gdy rola !== `'Personel'`. Wzorzec: kopia `server/utils/manager-guard.ts` z zamianą warunku na `session.user.role !== 'Personel'`.

#### 2. Lista gal personelu

**File**: `server/api/personel/events/index.get.ts`

**Intent**: Zwraca wszystkie opublikowane gale, do których przypisana jest osoba o emailu = email zalogowanego użytkownika. Wszystkie daty (przeszłe + nadchodzące), posortowane ASC.

**Contract**: `GET /api/personel/events` → `Array<{ id: string, name: string, date: string, venue: string, status: string, createdAt: string, roles: string[] }>`. Używa `requirePersonel` + `getD1`. SQL z sekcji Critical Implementation Details — `roles` to wynik `GROUP_CONCAT(DISTINCT a.role).split(',')`.

#### 3. Szczegóły gali dla personelu

**File**: `server/api/personel/events/[id].get.ts`

**Intent**: Zwraca szczegóły jednej gali z podziałem na: role event-level i przypisania do konkretnych walk. Dostępne tylko gdy osoba jest przypisana do tej gali.

**Contract**: `GET /api/personel/events/[id]` → `{ id, name, date, venue, status, createdAt, eventRoles: string[], fightAssignments: Array<{ fightId: string, orderNumber: number, role: string }> }`. Trzy oddzielne queries:
1. `SELECT id, name, date, venue, status, created_at FROM events WHERE id = ? AND status = 'published'` → 404 jeśli brak
2. `SELECT a.role FROM assignments a JOIN persons p ON p.id = a.person_id WHERE a.type = 'event' AND a.event_id = ? AND p.email = ?`
3. `SELECT f.id AS fightId, f.order_number AS orderNumber, a.role FROM assignments a JOIN persons p ON p.id = a.person_id JOIN fights f ON f.id = a.fight_id WHERE a.type = 'fight' AND f.event_id = ? AND p.email = ? ORDER BY f.order_number ASC`

Jeśli `eventRoles.length === 0 && fightAssignments.length === 0` → 404.

### Success Criteria

#### Automated Verification

- TypeScript kompiluje się bez błędów: `npm run build`
- Lint przechodzi: `npm run lint` (jeśli dostępne)

#### Manual Verification

- `GET /api/personel/events` jako Personel zwraca 200 z listą gal
- `GET /api/personel/events` jako Manager zwraca 403
- `GET /api/personel/events/[id]` dla gali gdzie personel jest przypisany zwraca dane
- `GET /api/personel/events/[id]` dla gali gdzie personel NIE jest przypisany zwraca 404

**Implementation Note**: Po ukończeniu tej fazy i przejściu automated verification — poczekaj na potwierdzenie manual verification przed przejściem do Phase 2.

---

## Phase 2: Frontend

### Overview

Middleware chroniący `/personel/*`, nowy PersonelNav, strona schedule.vue, patch index.vue z buttonem dla Personel.

### Changes Required

#### 1. Middleware dla personelu

**File**: `app/middleware/personel.ts`

**Intent**: Chronić wszystkie strony `/personel/*` przed dostępem ról innych niż `Personel`. Wzorzec: kopia `app/middleware/manager.ts` z zamianą warunku.

**Contract**: Eksportowany `defineNuxtRouteMiddleware`, sprawdza `user.value?.role === 'Personel'`. Jeśli nie — `navigateTo('/')`.

#### 2. Przycisk dla Personel na stronie głównej

**File**: `app/pages/index.vue`

**Intent**: Dodać link do `/personel/schedule` dla zalogowanego użytkownika z rolą `Personel`, tak jak Admin/Manager mają swoje linki.

**Contract**: W bloku `v-if="loggedIn"` dodaj:
```html
<a v-if="user?.role === 'Personel'" href="/personel/schedule" class="btn-manager">MOJE GALE →</a>
```
Reużyj istniejącą klasę `btn-manager` (taki sam styl jak linki managerskie).

#### 3. Komponent nawigacji personelu

**File**: `app/components/PersonelNav.vue`

**Intent**: Górny pasek nawigacyjny dla stron personelu: logo, link powrotu do `/`, nazwa użytkownika + wylogowanie.

**Contract**: Wzorzec: kopia `app/components/ManagerNav.vue` bez linków do `/admin/*` i `/manager/*`. Zawiera tylko: logo RINGABELL → `/`, przycisk "WRÓĆ" → `/`, w prawym rogu `user.value?.name` + przycisk wylogowania (`clear()` z `useUserSession()`). Bez `isAdmin` computed — Personel nie ma dodatkowych linków.

#### 4. Strona harmonogramu personelu

**File**: `app/pages/personel/schedule.vue`

**Intent**: Główna strona personelu. Lista opublikowanych gal z rolami. Kliknięcie otwiera panel szczegółów z event-level i fight-level przypisaniami. Empty state gdy brak gal.

**Contract**: Struktura:
- `definePageMeta({ middleware: 'personel' })`
- `useHead` z linkiem do Google Fonts (Space Grotesk) — wzorzec z `manager/events.vue:4`
- `const { data: events, refresh } = await useFetch<EventItem[]>('/api/personel/events')`
- `const selectedEvent = ref<EventDetail | null>(null)` — lokalny stan
- `async function openDetail(id: string)` — `$fetch('/api/personel/events/' + id)`, zapisuje do `selectedEvent`
- Template: `PersonelNav` na górze, lista kart gal (data, nazwa, venue, role jako badge'y), po prawej/poniżej panel detali gdy `selectedEvent` nie null
- Empty state `v-if="!events?.length"`: komunikat "Nie masz jeszcze przypisanych gal."
- Daty formatowane przez `formatDate()` z `@/utils/date.ts` (reguła z lessons.md)

### Success Criteria

#### Automated Verification

- TypeScript kompiluje się bez błędów: `npm run build`

#### Manual Verification

- Personel loguje się → widzi przycisk "MOJE GALE →" na `/`
- Wejście na `/personel/schedule` jako Manager/Admin przekierowuje na `/`
- Lista gal wyświetla się poprawnie z rolami
- Kliknięcie gali pokazuje szczegóły (event roles + walki)
- Empty state wyświetla się gdy brak gal lub email nie pasuje do żadnego Person
- PersonelNav ma działający przycisk wylogowania

**Implementation Note**: Po ukończeniu tej fazy i przejściu automated verification — poczekaj na potwierdzenie manual verification przed przejściem do Phase 3.

---

## Phase 3: Tests

### Overview

RBAC test (kto może, kto nie może) + integration test weryfikujący logikę SQL (email match, filtrowanie statusu, zwracane dane).

### Changes Required

#### 1. RBAC test

**File**: `server/api/personel/events/events.rbac.integration.test.ts`

**Intent**: Potwierdzić że tylko rola `Personel` ma dostęp do `/api/personel/events`. Manager i Admin powinni dostać 403.

**Contract**: Wzorzec: kopia `server/api/manager/events/events.rbac.integration.test.ts` z zamianą roli. Test cases:
- Personel → 200 na `GET /api/personel/events`
- Manager → 403
- Admin → 403

#### 2. Integration test

**File**: `server/api/personel/events/events.integration.test.ts`

**Intent**: Weryfikować logikę endpointów: email match, filtrowanie `status='published'`, zwracane pola, empty state, detail autoryzacja.

**Contract**: Test cases:
- `GET /api/personel/events` dla Personel bez rekordu Person → `[]`
- `GET /api/personel/events` dla Personel z przypisaniami do published event → zwraca event z rolami
- `GET /api/personel/events` nie zwraca eventów ze statusem `draft`
- `GET /api/personel/events/[id]` dla eventu do którego jest przypisany → 200 z danymi
- `GET /api/personel/events/[id]` dla eventu do którego NIE jest przypisany → 404

Seed: dodać do `test/fixtures/seed.sql` (lub lokalnie w teście) rekord Person z `email='personel@test.com'`, User z tym samym emailem i `role='Personel'`, opublikowany event z assignment tej osoby.

### Success Criteria

#### Automated Verification

- Wszystkie testy przechodzą: `npm test` (lub komenda testowa projektu)

#### Manual Verification

- Brak regresji w istniejących testach managerskich

**Implementation Note**: Po ukończeniu tej fazy i przejściu automated verification — poczekaj na potwierdzenie manual verification przed zakończeniem zmiany.

---

## Testing Strategy

### Integration Tests

- RBAC: Personel 200 / Manager 403 / Admin 403 na `/api/personel/events`
- Email match: tylko własne gale, nie wszystkie published
- Status filter: draft events niewidoczne
- Detail auth: 404 dla gal bez przypisania

### Manual Testing Steps

1. Zaloguj się jako Personel (Google OAuth z emailem pasującym do Person w bazie seed)
2. Sprawdź że `index.vue` pokazuje przycisk "MOJE GALE →"
3. Wejdź na `/personel/schedule` — lista gal z rolami
4. Kliknij galę — szczegóły w panelu bocznym
5. Zaloguj się jako Manager → próba wejścia na `/personel/schedule` → redirect na `/`

## References

- Wzorzec guard: `server/utils/manager-guard.ts`
- Wzorzec API list: `server/api/manager/events/index.get.ts`
- Wzorzec API detail: `server/api/manager/events/[id].get.ts`
- Wzorzec strony: `app/pages/manager/events.vue`
- Wzorzec nav: `app/components/ManagerNav.vue`
- Wzorzec middleware: `app/middleware/manager.ts`
- Date utils: `app/utils/date.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: API Layer

#### Automated

- [x] 1.1 TypeScript kompiluje się bez błędów: `npm run build`

#### Manual

- [ ] 1.2 GET /api/personel/events jako Personel zwraca 200 z listą gal
- [ ] 1.3 GET /api/personel/events jako Manager zwraca 403
- [ ] 1.4 GET /api/personel/events/[id] dla przypisanej gali zwraca dane
- [ ] 1.5 GET /api/personel/events/[id] dla nieprzypisanej gali zwraca 404

### Phase 2: Frontend

#### Automated

- [ ] 2.1 TypeScript kompiluje się bez błędów: `npm run build`

#### Manual

- [ ] 2.2 Personel widzi przycisk "MOJE GALE →" na stronie głównej po zalogowaniu
- [ ] 2.3 Manager/Admin na /personel/schedule przekierowuje na /
- [ ] 2.4 Lista gal wyświetla się z rolami i datami
- [ ] 2.5 Kliknięcie gali pokazuje szczegóły
- [ ] 2.6 Empty state wyświetla się gdy brak przypisań
- [ ] 2.7 PersonelNav — wylogowanie działa

### Phase 3: Tests

#### Automated

- [ ] 3.1 Wszystkie testy przechodzą: `npm test`

#### Manual

- [ ] 3.2 Brak regresji w istniejących testach managerskich
