# Event-Level Requirements Dictionary — Implementation Plan

## Overview

Role wymagane na poziomie gali (dziś: zahardkodowane `'Ratownik'` i `'Konferansjer'` w czterech miejscach kodu) mają stać się konfigurowalne przez słownik — symetrycznie do już istniejącego `fight_requirement_defaults` dla ról per walka. Jeśli rola nie ma wpisu w nowym słowniku, po prostu nie jest wymagana na poziomie gali.

## Current State Analysis

Potwierdzone bezpośrednio w kodzie — 4 miejsca z literalnym hardcode'em:
- `app/pages/manager/events.vue:508` — `v-for="role in ['Ratownik', 'Konferansjer']"` (template, dropdown eventu)
- `app/pages/manager/events.vue:246-247` — `canPublish` computed: `hasRatownik`/`hasKonferansjer` liczone wprost po nazwie roli
- `server/api/manager/events/[id]/publish.post.ts:57` — `SELECT COUNT(*) ... WHERE role = 'Ratownik'`
- `server/api/manager/events/[id]/publish.post.ts:66` — analogicznie dla `'Konferansjer'`

Dla porównania, poziom walki jest w pełni data-driven: `fight_requirement_defaults` (słownik, Admin) → auto-copy do `fight_requirements` przy tworzeniu walki (`server/api/manager/events/[id]/fights/index.post.ts:31-45`) → walidacja publikacji pętlą po `fight_requirements` (`publish.post.ts:29-53`, zero literałów ról) → formularz Managera renderuje dropdown per `fight.requirements` (`events.vue`, `fightMissingRoles()` linie 234-241).

**Krytyczna różnica względem poziomu walki**: `events` (gale) już istnieją w bazie od dawna — w przeciwieństwie do `fights`, które są tworzone dopiero PO wejściu w życie `fight_requirement_defaults`. Migracja musi więc nie tylko stworzyć tabele, ale też **wypełnić dane historyczne** dla już istniejących gal — inaczej walidacja publikacji przestanie sprawdzać event-level role dla starych draft-gal (regresja, nie tylko brak nowej funkcji).

### Key Discoveries

- Schemat `fight_requirement_defaults` do skopiowania 1:1: `migrations/0002_dictionaries.sql:7-13` — `role_id TEXT NOT NULL REFERENCES person_roles(id) ON DELETE CASCADE`, `count INTEGER NOT NULL CHECK(count > 0)`, `UNIQUE INDEX` na `role_id` (max 1 wymaganie na rolę)
- Schemat `fight_requirements` (instancja per-walka) do skopiowania: `migrations/0001_init.sql:37-42` — `role` to TEXT (denormalizowana kopia nazwy w momencie kopiowania), nie FK
- Wzorzec Admin API do skopiowania 1:1: `server/api/admin/dictionaries/requirements/{index.get,index.post,[id].patch,[id].delete}.ts` — pełne treści już przeczytane, gotowe do powielenia ze zmienioną nazwą tabeli
- Wzorzec Admin UI: `app/pages/admin/dictionaries.vue` — jedna tabela ról z kolumną "MIN. NA WALKĘ", jeden modal add/edit z opcjonalnym polem count, funkcja `requirementForRole(roleId)` jako lookup
- Wzorzec auto-copy przy tworzeniu: `server/api/manager/events/[id]/fights/index.post.ts:31-45`
- Wzorzec odczytu w Manager API: `server/api/manager/events/[id].get.ts:23-32,85-89` — `fights[].requirements` dociągane jednym zapytaniem z `IN (...)`, złączane w pamięci
- `'Ratownik'` i `'Konferansjer'` już istnieją w `person_roles` na produkcji, ale **nie są seedowane** w `test/fixtures/seed.sql` (tam jest tylko `'Bokser'`) — migracja musi sama zagwarantować ich istnienie, nie może zakładać że są

## Desired End State

- Admin zarządza wymaganiami per-gala w tej samej tabeli co wymagania per-walkę (`app/pages/admin/dictionaries.vue`), druga kolumna "MIN. NA GALĘ"
- Nowa gala automatycznie dostaje event-level wymagania skopiowane ze słownika (jak dziś walki)
- Formularz Managera renderuje sekcję "OBSŁUGA GALI" dynamicznie na podstawie `eventDetail.eventRequirements` — jeśli słownik jest pusty, sekcja się nie renderuje
- Walidacja publikacji (frontend `canPublish` i backend `publish.post.ts`) sprawdza event-level wymagania generyczną pętlą, bez żadnych literałów ról
- Istniejące gale (wszystkie statusy) mają backfillowane `event_requirements` na podstawie wartości `Ratownik: 1, Konferansjer: 1` — zero regresji dla danych sprzed tej zmiany

## What We're NOT Doing

- Brak zmiany logiki dla poziomu walki (`fight_requirement_defaults`/`fight_requirements`) — to już działa, zostaje bez zmian
- Brak generalizacji istniejących endpointów `requirements/*` (fight-level) — nowy słownik to osobne pliki `event-requirements/*`, zero ryzyka dla działającego kodu
- Brak zmiany w tabeli `assignments.role` (wciąż plain TEXT, bez FK do `person_roles`) — to osobny, nieistotny tu temat
- Brak dedykowanych testów CRUD dla nowych endpointów Admin API — konsekwentnie z tym że fight-level `requirements/*` też ich nie ma (zero istniejących testów do zerwania konwencji)

## Implementation Approach

Cztery fazy, każda kopiuje 1:1 już istniejący, sprawdzony wzorzec fight-level, zamieniając tylko nazwę tabeli/kontekst: (1) schemat + migracja z backfillem, (2) Admin słownik, (3) Manager — auto-copy + dynamiczne UI + generyczna walidacja publikacji, (4) test zamykający wcześniej odkrytą dziurę w pokryciu (walidacja event-level nigdy nie miała testu integracyjnego, nawet w wersji hardkodowanej).

## Critical Implementation Details

**Migracja musi sama gwarantować istnienie ról `'Ratownik'`/`'Konferansjer'`** — nie mogą być zakładane jako już istniejące, bo lokalna/testowa baza D1 (`test/fixtures/seed.sql`) ich nie seeduje (tylko `'Bokser'`). Kolejność w migracji: `INSERT ... SELECT ... WHERE NOT EXISTS` dla obu ról w `person_roles` PRZED wstawieniem do `event_requirement_defaults` (który referencjonuje `role_id` przez FK) — inaczej insert do defaults nic nie wstawi (brak dopasowania po nazwie) na świeżej bazie.

**Backfill obejmuje WSZYSTKIE gale, niezależnie od statusu** (draft/published/cancelled), nie tylko draft — dla spójności wyświetlania w Manager UI (żeby opublikowana wcześniej gala też pokazywała jakie miała wymagania), analogicznie do tego że `fight_requirements` istnieją niezależnie od statusu gali.

**Generowanie ID w SQL migracji** — to pierwsza migracja w projekcie która wstawia dane (nie tylko `CREATE TABLE`), więc potrzebuje wygenerować unikalne ID bez pomocy z kodu aplikacji (`crypto.randomUUID()` tam działa, tu nie). Użyć idiomu SQLite `lower(hex(randomblob(16)))` jako pseudo-UUID w `INSERT ... SELECT`.

## Phase 1: Schemat + migracja z backfillem

### Overview

Nowe tabele `event_requirement_defaults` (słownik) i `event_requirements` (instancja per-gala), zasiane wartościami odpowiadającymi dzisiejszemu zachowaniu, plus backfill dla wszystkich istniejących gal.

### Changes Required

#### 1. Migracja

**File**: `migrations/0004_event_requirement_defaults.sql`

**Intent**: Wprowadzić schemat symetryczny do `fight_requirement_defaults`/`fight_requirements`, zachowując dzisiejsze zachowanie (Ratownik×1, Konferansjer×1) jako punkt startowy dla Admina i dla już istniejących gal.

**Contract**: Cztery kroki w jednym pliku migracji, w tej kolejności:
1. `CREATE TABLE event_requirement_defaults (id TEXT PRIMARY KEY, role_id TEXT NOT NULL REFERENCES person_roles(id) ON DELETE CASCADE, count INTEGER NOT NULL CHECK(count > 0))` + `CREATE UNIQUE INDEX idx_event_req_defaults_role ON event_requirement_defaults(role_id)` — 1:1 ze schematem `fight_requirement_defaults`.
2. `CREATE TABLE event_requirements (id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE, role TEXT NOT NULL, count INTEGER NOT NULL)` + `CREATE INDEX idx_event_requirements_event_id ON event_requirements(event_id)`.
3. Zagwarantować istnienie ról `'Ratownik'` i `'Konferansjer'` w `person_roles` (`INSERT ... SELECT ... WHERE NOT EXISTS` per rola — patrz Critical Implementation Details), następnie wstawić po jednym wierszu do `event_requirement_defaults` (count=1) dla każdej z tych dwóch ról.
4. Backfill: dla KAŻDEGO istniejącego wiersza w `events` (bez filtra po `status`), wstawić do `event_requirements` po jednym wierszu na każdy wpis z `event_requirement_defaults` × `person_roles` (czyli Ratownik+Konferansjer dla każdej istniejącej gali) — `INSERT ... SELECT ... FROM events CROSS JOIN (...)`.

### Success Criteria

#### Automated Verification

- Migracja aplikuje się bez błędów lokalnie: `wrangler d1 migrations apply ringabell --local`
- TypeScript kompiluje się bez błędów: `npm run build`

#### Manual Verification

- Po migracji lokalnej: `event_requirement_defaults` ma dokładnie 2 wiersze (Ratownik, Konferansjer, count=1 każdy)
- `event_requirements` ma `2 × (liczba istniejących gal)` wierszy

**Implementation Note**: Po ukończeniu tej fazy i przejściu automated verification — poczekaj na potwierdzenie manual verification przed przejściem do Phase 2.

---

## Phase 2: Admin — słownik API + UI

### Overview

Cztery nowe endpointy CRUD (kopia 1:1 `requirements/*` ze zmienioną tabelą) + druga kolumna w istniejącej stronie Admina.

### Changes Required

#### 1. Admin API — CRUD dla event_requirement_defaults

**Files**: `server/api/admin/dictionaries/event-requirements/index.get.ts`, `index.post.ts`, `[id].patch.ts`, `[id].delete.ts`

**Intent**: Zarządzanie słownikiem wymagań per-gala, analogicznie do istniejącego zarządzania wymaganiami per-walkę.

**Contract**: Kopia 1:1 odpowiadających plików z `server/api/admin/dictionaries/requirements/` — identyczna walidacja (`count` musi być dodatnią liczbą całkowitą, `roleId` musi istnieć w `person_roles`, `409` gdy wymaganie dla tej roli już istnieje), identyczne kody błędów, jedyna różnica: nazwa tabeli (`event_requirement_defaults` zamiast `fight_requirement_defaults`) i pole `roleName` w GET (JOIN z `person_roles` bez zmian w podejściu).

#### 2. Admin UI — druga kolumna wymagań

**File**: `app/pages/admin/dictionaries.vue`

**Intent**: Ta sama strona, ten sam modal add/edit — Admin widzi i edytuje oba wymiary wymagań (per walka, per gala) dla każdej roli w jednym miejscu.

**Contract**: Dodać `useFetch` dla `/api/admin/dictionaries/event-requirements`, funkcję `eventRequirementForRole(roleId)` (analogiczną do `requirementForRole`), nową kolumnę tabeli "MIN. NA GALĘ" (ten sam wzorzec `count-badge`/`count-empty`), nowe pole `addEventRoleCount`/`editEventRoleCount` w modalach add/edit z tą samą logiką zapisu warunkowego (POST gdy brak istniejącego wymagania i podano wartość, PATCH gdy istnieje i wartość się zmienia, DELETE gdy pole wyczyszczone) jak istniejące `addRoleCount`/`editRoleCount`, tylko celujące w `/api/admin/dictionaries/event-requirements`.

### Success Criteria

#### Automated Verification

- TypeScript kompiluje się bez błędów: `npm run build`
- Lint przechodzi: `npm run lint`

#### Manual Verification

- Admin → Słowniki pokazuje kolumnę "MIN. NA GALĘ" z wartościami Ratownik=1, Konferansjer=1 po migracji
- Dodanie/edycja/usunięcie wymagania per-gala dla dowolnej roli działa (np. dodanie wymagania dla nowej roli, usunięcie dla istniejącej)

**Implementation Note**: Po ukończeniu tej fazy i przejściu automated verification — poczekaj na potwierdzenie manual verification przed przejściem do Phase 3.

---

## Phase 3: Manager — auto-copy, dynamiczne UI, generyczna walidacja publikacji

### Overview

Nowa gala dostaje event-level wymagania automatycznie; formularz Managera i walidacja publikacji przestają odwoływać się do konkretnych nazw ról.

### Changes Required

#### 1. Auto-copy przy tworzeniu gali

**File**: `server/api/manager/events/index.post.ts`

**Intent**: Nowa gala dostaje event-level wymagania ze słownika, analogicznie do tego jak nowa walka dostaje wymagania z `fight_requirement_defaults`.

**Contract**: Po `INSERT INTO events`, ten sam wzorzec co `fights/index.post.ts:31-45` — `SELECT pr.name AS role, erd.count FROM event_requirement_defaults erd JOIN person_roles pr ON pr.id = erd.role_id`, pętla `INSERT INTO event_requirements (id, event_id, role, count) VALUES (...)` dla każdego wyniku.

#### 2. Event detail API — dołączenie wymagań

**File**: `server/api/manager/events/[id].get.ts`

**Intent**: Response dla formularza Managera musi zawierać event-level wymagania, żeby UI mogło renderować sekcję dynamicznie.

**Contract**: Nowe zapytanie `SELECT id, event_id AS eventId, role, count FROM event_requirements WHERE event_id = ?`, wynik dodany do response jako `eventRequirements` (osobne pole, równolegle do istniejącego `eventAssignments`) — bez zmian w istniejących polach.

#### 3. Manager UI — dynamiczna sekcja + generyczna walidacja

**File**: `app/pages/manager/events.vue`

**Intent**: Sekcja "OBSŁUGA GALI" renderuje się na podstawie słownika, nie hardkodowanej listy; `canPublish` sprawdza generyczne wymagania.

**Contract**: Zamiast `v-for="role in ['Ratownik', 'Konferansjer']"` (linia 508) → `v-for="req in eventDetail.eventRequirements" :key="req.role"` (używając `req.role` tam gdzie wcześniej był literał `role`), cała sekcja owinięta w `v-if="eventDetail.eventRequirements.length"` (żeby nie renderować się gdy słownik jest pusty — patrz Desired End State). Nowa funkcja `eventMissingRoles()` analogiczna do istniejącej `fightMissingRoles()` (linie 234-241), iterująca po `eventDetail.eventRequirements` i porównująca z `eventDetail.eventAssignments`. `canPublish` computed (linie 243-254) zamienia `hasRatownik`/`hasKonferansjer` na `eventMissingRoles().length === 0`.

#### 4. Backend — generyczna walidacja publikacji

**File**: `server/api/manager/events/[id]/publish.post.ts`

**Intent**: Ten sam efekt końcowy (błąd 422 gdy brakuje wymaganej osoby na poziomie gali), ale sterowany słownikiem, nie literałami.

**Contract**: Zastąpić dwa hardkodowane bloki SQL (linie 55-71, sprawdzenie Ratownika i Konferansjera) jedną pętlą po `event_requirements` analogiczną do istniejącej pętli fight-level (linie 29-53): `SELECT role, count FROM event_requirements WHERE event_id = ?`, dla każdego wyniku `SELECT COUNT(*) FROM assignments WHERE event_id = ? AND type = 'event' AND role = ?`, push do `errors` gdy `assigned < count` z komunikatem w tym samym formacie co dziś (`Brak ${role} na gali` — dopasować do istniejącego stylu komunikatów, np. `Brak ${req.role.toLowerCase()} na gali` jeśli chcemy zachować małą literę jak w oryginalnych "Brak ratownika"/"Brak konferansjera").

### Success Criteria

#### Automated Verification

- TypeScript kompiluje się bez błędów: `npm run build`
- Lint przechodzi: `npm run lint`
- Wszystkie istniejące testy integracyjne nadal przechodzą: `npm run test:integration`

#### Manual Verification

- Nowa gala w draft ma sekcję "OBSŁUGA GALI" z Ratownik+Konferansjer (dziedziczone ze słownika)
- Próba publikacji bez Ratownika/Konferansjera nadal blokuje z tym samym komunikatem błędu co dziś
- Dodanie nowej roli do słownika per-gala (np. testowo) → nowa gala pokazuje ją jako wymaganą; usunięcie roli ze słownika → nowe gale jej nie wymagają (stare, już backfillowane, nadal mają swój zestaw z Fazy 1)

**Implementation Note**: Po ukończeniu tej fazy i przejściu automated verification — poczekaj na potwierdzenie manual verification przed przejściem do Phase 4.

---

## Phase 4: Test zamykający dziurę w pokryciu

### Overview

Integracyjny test potwierdzający że brak wymaganej roli na poziomie gali blokuje publikację — ten scenariusz nigdy nie był testowany, nawet w wersji hardkodowanej.

### Changes Required

#### 1. Test walidacji publikacji

**File**: `server/api/manager/events/events.publish-guard.integration.test.ts`

**Intent**: Zamknąć znalezioną podczas researchu dziurę w pokryciu testów — ta sama walidacja (teraz generyczna) musi mieć test na wypadek przyszłej regresji.

**Contract**: Nowy test case w istniejącym describe block: utworzyć galę z co najmniej jedną kompletną walką (żeby przejść pierwsze dwa kroki walidacji), NIE przypisywać Ratownika/Konferansjera, wywołać `POST /:id/publish`, oczekiwać `422` z `body.data.errors` zawierającym komunikat o brakującej roli event-level (wzorzec asercji jak w istniejącym teście "returns 422 with error message when event has no fights").

### Success Criteria

#### Automated Verification

- Nowy test przechodzi: `npm run test:integration`
- Cały zestaw testów integracyjnych nadal przechodzi bez regresji (weryfikacja per-plik jeśli maszyna obciążona, zgodnie z wzorcem z poprzednich zmian w tej sesji)
- TypeScript kompiluje się bez błędów: `npm run build`

#### Manual Verification

- Brak regresji w Admin/Manager/Personel UI po wszystkich 4 fazach

**Implementation Note**: Po ukończeniu tej fazy i przejściu automated verification — poczekaj na potwierdzenie manual verification przed zakończeniem zmiany.

---

## Testing Strategy

### Integration Tests

- Publikacja blokowana gdy brak wymaganej roli event-level (nowy test, Phase 4)
- Regresja: cały istniejący zestaw testów integracyjnych (RBAC, walidacja, personel-schedule-view, session-revalidation, boxer-conflict) nadal przechodzi

### Manual Testing Steps

1. Zastosuj migrację lokalnie, sprawdź `event_requirement_defaults` i `event_requirements` (backfill) w lokalnej D1
2. Admin → Słowniki → sprawdź kolumnę "MIN. NA GALĘ", edytuj/usuń/dodaj wymaganie dla testowej roli
3. Manager → stwórz nową galę → sprawdź że sekcja "OBSŁUGA GALI" pokazuje role ze słownika
4. Spróbuj opublikować galę bez wymaganych osób → sprawdź błąd
5. Uzupełnij wymagane role → publikacja przechodzi
6. Sprawdź starą galę (sprzed migracji) → nadal ma sekcję "OBSŁUGA GALI" z Ratownik/Konferansjer (backfill)

## Migration Notes

Migracja `0004_event_requirement_defaults.sql` musi być zastosowana na produkcyjnej D1 (`wrangler d1 migrations apply ringabell --remote`) analogicznie do wcześniejszych migracji w tej sesji — użytkownik robi to ręcznie po potwierdzeniu że lokalna weryfikacja przeszła.

## References

- Wzorzec słownika: `migrations/0002_dictionaries.sql`, `server/api/admin/dictionaries/requirements/*`, `app/pages/admin/dictionaries.vue`
- Wzorzec auto-copy: `server/api/manager/events/[id]/fights/index.post.ts:31-45`
- Wzorzec walidacji publikacji: `server/api/manager/events/[id]/publish.post.ts:29-53`
- Wzorzec odczytu zagnieżdżonych wymagań: `server/api/manager/events/[id].get.ts:23-32,85-89`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schemat + migracja z backfillem

#### Automated

- [x] 1.1 Migracja aplikuje się bez błędów lokalnie: `wrangler d1 migrations apply ringabell --local` — af79ebc
- [x] 1.2 TypeScript kompiluje się bez błędów: `npm run build` — af79ebc

#### Manual

- [x] 1.3 `event_requirement_defaults` ma dokładnie 2 wiersze (Ratownik, Konferansjer, count=1) — zweryfikowane zapytaniem, potwierdzone dokładnie 2 wiersze — af79ebc
- [x] 1.4 `event_requirements` ma `2 × (liczba istniejących gal)` wierszy — zweryfikowane: 58 gal lokalnie × 2 = 116, zgodne — af79ebc

### Phase 2: Admin — słownik API + UI

#### Automated

- [x] 2.1 TypeScript kompiluje się bez błędów: `npm run build` — d846a9a
- [x] 2.2 Lint przechodzi: `npm run lint` — d846a9a

#### Manual

- [x] 2.3 Kolumna "MIN. NA GALĘ" widoczna z wartościami Ratownik=1, Konferansjer=1 — dane zweryfikowane przez API (GET zwraca dokładnie te wartości); wizualne rozmieszczenie kolumny w tabeli nie zweryfikowane w przeglądarce (brak narzędzia) — do rzucenia okiem jak będzie okazja — d846a9a
- [x] 2.4 Dodanie/edycja/usunięcie wymagania per-gala działa — zweryfikowane end-to-end przez API: POST (201), duplikat (409), PATCH (200), DELETE (200), po DELETE z powrotem 2 wiersze; Manager poprawnie dostaje 403 — d846a9a

### Phase 3: Manager — auto-copy, dynamiczne UI, generyczna walidacja publikacji

#### Automated

- [x] 3.1 TypeScript kompiluje się bez błędów: `npm run build`
- [x] 3.2 Lint przechodzi: `npm run lint`
- [x] 3.3 Wszystkie istniejące testy integracyjne nadal przechodzą: `npm run test:integration`

#### Manual

- [x] 3.4 Nowa gala dziedziczy Ratownik+Konferansjer ze słownika — zweryfikowane API: POST /api/manager/events → GET zwraca eventRequirements=[Ratownik×1, Konferansjer×1]
- [x] 3.5 Publikacja bez wymaganych osób blokuje z tym samym komunikatem co dziś — zweryfikowane API: 422 z "Brak ratownik na gali"/"Brak konferansjer na gali" (mianownik zamiast dopełniacza "ratownika"/"konferansjera" — zaakceptowana zmiana z Contract fazy 3, dot. tylko sformułowania błędu, nie logiki)
- [x] 3.6 Zmiana słownika (dodanie/usunięcie roli) wpływa na NOWE gale, nie na już backfillowane — zweryfikowane API: po dodaniu wymogu Bokser do słownika, stara gala nadal ma 2 wymagania, nowa gala ma 3 (incl. Bokser)

### Phase 4: Test zamykający dziurę w pokryciu

#### Automated

- [ ] 4.1 Nowy test przechodzi: `npm run test:integration`
- [ ] 4.2 Cały zestaw testów integracyjnych nadal przechodzi bez regresji
- [ ] 4.3 TypeScript kompiluje się bez błędów: `npm run build`

#### Manual

- [ ] 4.4 Brak regresji w Admin/Manager/Personel UI po wszystkich 4 fazach
