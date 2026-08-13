# Fight Corner Assignment Implementation Plan

## Overview

Wprowadzamy podział ról walki na **czerwony** i **niebieski narożnik**. Admin oznacza w Słownikach, które role są "narożnikowe" (typowo: Bokser, Trener, Cutman) — dla takich ról liczba z "MIN. NA WALKĘ" jest dzielona równo na dwa narożniki (np. Cutman=4 → 2 czerwony + 2 niebieski). Manager przy edycji walki widzi dwie oddzielne, stylizowane sekcje (czerwoną i niebieską) do obsadzenia tych ról, plus sekcję "INNE" dla ról bez narożnika (Sędzia, Lekarz, Ratownik, Konferansjer...). Personel widzi przypisania z prefiksem "CZERWONY:"/"NIEBIESKI:".

## Current State Analysis

- `assignments` (`migrations/0001_init.sql:44-51`, cascade w `0003_assignments_cascade.sql`) nie ma pojęcia narożnika — każdy slot to tylko `role` + pozycja w tablicy zwróconej z zapytania (bez `ORDER BY`, kolejność nie jest gwarantowana po edycji).
- `fight_requirement_defaults` i `fight_requirements` (`migrations/0002_dictionaries.sql`, `migrations/0001_init.sql:37-42`) mają tylko `role_id`/`role` + `count` — nic o narożniku.
- Manager UI (`app/pages/manager/events.vue:341-353,222-238`) renderuje sloty przez `v-for="slotIdx in req.count"`, identyfikuje slot przez `(fight, role, slotIndex)` — pozycja w tablicy, nie etykieta narożnika. `availableForFightSlot()` ma już specjalny przypadek dla `role.toLowerCase() === 'bokser'` (blokada tego samego boksera w dwóch walkach tej samej gali) — wzorzec do naśladowania dla blokady "ten sam narożnik".
- Backend walidacji publikacji (`server/api/manager/events/[id]/publish.post.ts:29-53`) liczy `COUNT(*) FROM assignments WHERE fight_id = ? AND role = ?` — sumarycznie, bez rozróżnienia narożnika.
- `server/api/manager/assignments/index.post.ts` (88 linii, pełna treść przeczytana) — jedyna walidacja specyficzna dla roli to blokada "ten sam bokser w dwóch walkach tej samej gali" (linie 46-59), keyowana `role.toLowerCase() === 'bokser'`. Brak pojęcia narożnika.
- Personel (`server/api/personel/events/[id].get.ts:47-57`, `app/pages/personel/schedule.vue:128-155`) renderuje płaską listę `{ role, personName, isMe }` per walka, `v-for` key to `role + personName` (potencjalna kolizja jeśli dwie osoby mają tę samą rolę — dziś nieszkodliwe bo różne `personName`, ale trzeba to mieć na uwadze przy dodawaniu narożnika).

### Key Discoveries:

- `app/pages/admin/dictionaries.vue` ma już wzorzec pola liczbowego + walidacji w modalu Add/Edit roli (`addRoleCount`/`editRoleCount`) — checkbox narożnika idzie obok tego samego pola.
- `server/api/manager/events/[id]/fights/index.post.ts:31-45` — auto-copy `fight_requirement_defaults` → `fight_requirements` przy tworzeniu walki; trzeba dodać kopiowanie nowej flagi.
- SQLite/D1 wspiera proste `ALTER TABLE ... ADD COLUMN` (potwierdzone w tym repo — inne migracje używają wzorca create-copy-drop-rename tylko gdy zmieniają FK constraints, nie przy dodawaniu nowej nullable/default kolumny) — migracja może być jednym prostym plikiem z trzema `ALTER TABLE ADD COLUMN`.
- `server/models/assignment.ts` — współdzielony interfejs TS, wymaga dodania `corner`.

## Desired End State

Admin w Słownikach zaznacza checkbox "NAROŻNIK" dla Bokser/Trener/Cutman (i ustawia parzystą liczbę — walidacja blokuje nieparzyste). Nowa walka dziedziczy tę flagę. Manager przy edycji walki widzi:
- Czerwoną sekcję (ramka + label "CZERWONY NAROŻNIK") z polami dla każdej roli narożnikowej, `count/2` slotów każda.
- Niebieską sekcję (analogicznie, "NIEBIESKI NAROŻNIK").
- Sekcję "INNE" pod nimi z rolami bez narożnika (dokładnie jak dziś).

Ta sama osoba nie może być przypisana do tej samej roli w obu narożnikach jednej walki (409). Publikacja blokuje się jeśli KTÓRYKOLWIEK narożnik nie ma wypełnionych `count/2` miejsc dla danej roli — nie wystarczy suma. Personel widzi "CZERWONY: Kowalski — Trener" / "NIEBIESKI: Nowak — Trener" w płaskiej liście, bez zmiany layoutu.

Weryfikacja: nowa walka z rolą narożnikową (np. Trener=2 → 1+1) ma dwie sekcje po jednym slocie; próba przypisania tej samej osoby do obu narożników → 409; publikacja bez wypełnienia jednego narożnika → 422 z komunikatem wskazującym który narożnik.

## What We're NOT Doing

- Nie migrujemy istniejących przypisań na narożnik — wszystkie dzisiejsze dane mają `has_corner = 0` / `corner = NULL` (bezpieczny default, zero zmiany zachowania dla istniejących ról/walk).
- Nie blokujemy przypisania tej samej osoby do RÓŻNYCH ról w dwóch narożnikach (np. Bokser-czerwony i Trener-niebieski tej samej walki) — blokada dotyczy tylko tej samej roli w obu narożnikach.
- Nie zmieniamy niczego dla ról bez narożnika — zachowanie identyczne jak dziś (suma na całą walkę, generyczne sloty po indeksie).
- Nie dodajemy automatycznego wyrównywania nieparzystych liczb — Admin dostaje błąd walidacji, nie automatyczne zaokrąglenie.
- Nie zmieniamy layoutu widoku Personelu poza dopiskiem prefiksu — sekcje/kolory zostają na Managera.

## Implementation Approach

Baza+Admin → Backend Manager → Frontend (Manager+Personel) → Testy. Migracja jednym plikiem (3 proste `ALTER TABLE ADD COLUMN`, bezpieczne defaulty). `has_corner` żyje równolegle w dwóch tabelach jak `role`/`count` już żyją (denormalizacja: `fight_requirement_defaults` to słownik, `fight_requirements` to zdenormalizowana kopia per-walka skopiowana w momencie tworzenia walki — ten sam wzorzec, jedna nowa kolumna).

## Critical Implementation Details

**Blokada duplikatu narożnika** — analogicznie do istniejącej blokady "ten sam bokser w dwóch walkach" (`server/api/manager/assignments/index.post.ts:46-59`), nowa walidacja w tym samym endpointzie: przy `POST` z `corner` ustawionym, sprawdź czy `person_id` ma już przypisanie z tym samym `role` i `fight_id`, ale `corner` równym PRZECIWNEMU narożnikowi — jeśli tak, 409. To sprawdzenie jest niezależne od istniejącej blokady bokserskiej (może zadziałać dla Trener/Cutman też).

**Walidacja parzystości w Admin API** — `count % 2 !== 0` gdy `hasCorner === true` → 400 z komunikatem "count must be even when hasCorner is enabled". Sprawdzenie musi być w OBU miejscach: `POST` (nowy wymóg) i `PATCH` (edycja count na roli, która już ma `hasCorner=true`, ORAZ edycja `hasCorner` na roli, która już ma nieparzysty count — PATCH musi znać finalny stan obu pól, nie tylko pola które się zmienia).

## Phase 1: Baza + Admin — has_corner, corner, checkbox w Słownikach

### Overview

Migracja dodająca trzy kolumny. Admin API i UI pozwalają oznaczyć rolę jako narożnikową z walidacją parzystości.

### Changes Required:

#### 1. Migracja

**File**: `migrations/0006_fight_corner_assignment.sql`

**Intent**: Dodać pole flagujące "ta rola ma narożnik" do obu tabel wymagań walki, i pole "który narożnik" do przypisań.

**Contract**: Trzy `ALTER TABLE ... ADD COLUMN`:
- `fight_requirement_defaults.has_corner INTEGER NOT NULL DEFAULT 0`
- `fight_requirements.has_corner INTEGER NOT NULL DEFAULT 0`
- `assignments.corner TEXT` (nullable, brak CHECK — walidacja wartości `'red'`/`'blue'` po stronie API, zgodnie z tym jak `role`/`type` też nie mają wszystkich reguł na poziomie CHECK w tym repo)

#### 2. Model TS

**File**: `server/models/assignment.ts`

**Intent**: Odzwierciedlić nowe pole w współdzielonym typie.

**Contract**: Dodać `corner?: 'red' | 'blue' | null` do interfejsu `Assignment`.

#### 3. Admin API — GET

**File**: `server/api/admin/dictionaries/requirements/index.get.ts`

**Intent**: Zwrócić flagę narożnika razem z resztą danych wymagania.

**Contract**: Dodać `frd.has_corner AS hasCorner` do `SELECT`.

#### 4. Admin API — POST

**File**: `server/api/admin/dictionaries/requirements/index.post.ts`

**Intent**: Pozwolić ustawić `hasCorner` przy tworzeniu wymagania, z walidacją parzystości.

**Contract**: Przyjąć `hasCorner?: boolean` z body. Gdy `hasCorner === true` i `count % 2 !== 0` → 400. `INSERT` dodaje kolumnę `has_corner` (bind `hasCorner ? 1 : 0`).

#### 5. Admin API — PATCH

**File**: `server/api/admin/dictionaries/requirements/[id].patch.ts`

**Intent**: Pozwolić edytować `hasCorner` i/lub `count`, z tą samą walidacją parzystości stosowaną do FINALNEGO stanu (nie tylko zmienianego pola).

**Contract**: Przyjąć `hasCorner?: boolean` z body (opcjonalne, domyślnie zachowaj istniejącą wartość — trzeba ją najpierw odczytać z bazy przed walidacją). Walidacja: jeśli finalny `hasCorner === true`, finalny `count` musi być parzysty → inaczej 400. `UPDATE` ustawia obie kolumny.

#### 6. Admin UI — checkbox narożnika

**File**: `app/pages/admin/dictionaries.vue`

**Intent**: Admin może zaznaczyć "ta rola ma narożnik" przy dodawaniu/edycji roli, obok pola "MIN. NA WALKĘ".

**Contract**: Nowe pole `addRoleHasCorner`/`editRoleHasCorner` (boolean, checkbox) w obu modalach (Add/Edit), przekazywane jako `hasCorner` w POST/PATCH do `/api/admin/dictionaries/requirements`. Walidacja parzystości powtórzona po stronie klienta (natychmiastowy feedback, disable przycisku zapisu jeśli `hasCorner` zaznaczone i `count` nieparzyste) — serwer i tak waliduje ponownie. W tabeli ról: `count-badge` dostaje mały dopisek/ikonę gdy `hasCorner` (np. "×2 (1+1)" pokazujące podział), żeby Admin widział podział bez otwierania modala.

### Success Criteria:

#### Automated Verification:

- Migracja aplikuje się bez błędów lokalnie: `wrangler d1 migrations apply ringabell --local`
- TypeScript kompiluje się bez błędów: `npm run build`
- Lint czysty na zmienionych plikach

#### Manual Verification:

- Admin → Słowniki: checkbox "NAROŻNIK" działa, zapisuje się i wczytuje poprawnie
- Ustawienie nieparzystej liczby z zaznaczonym narożnikiem pokazuje błąd, nie zapisuje się

**Implementation Note**: Po zakończeniu tej fazy i przejściu automated verification — poczekaj na potwierdzenie manualnej weryfikacji przed przejściem do Fazy 2.

---

## Phase 2: Backend Manager — walidacja corner, auto-copy, publish per-narożnik

### Overview

Endpointy Managera zaczynają rozumieć narożnik: przyjmują go przy przypisywaniu, kopiują flagę przy tworzeniu walki, zwracają go w odczycie, i wymagają go osobno per narożnik przy publikacji.

### Changes Required:

#### 1. Auto-copy przy tworzeniu walki

**File**: `server/api/manager/events/[id]/fights/index.post.ts`

**Intent**: Nowa walka dziedziczy flagę narożnika razem z rolą i liczbą.

**Contract**: `SELECT` w bloku auto-copy (linie 31-38) dodaje `frd.has_corner AS hasCorner`; `INSERT` do `fight_requirements` (linia 42) dodaje kolumnę `has_corner`.

#### 2. Walidacja i blokada duplikatu w assignments

**File**: `server/api/manager/assignments/index.post.ts`

**Intent**: Przyjąć `corner`, wymusić go gdy rola jest narożnikowa (i zablokować gdy nie jest), zablokować tę samą osobę w obu narożnikach tej samej roli/walki.

**Contract**: Przyjąć `corner?: 'red' | 'blue'` z body. Gdy `type === 'fight'`: odczytać `has_corner` dla `(fightId, role)` z `fight_requirements` — jeśli `has_corner` prawda, `corner` wymagany (400 jeśli brak/niepoprawna wartość); jeśli `has_corner` fałsz, `corner` musi być nieustawiony (400 jeśli podany). Nowa blokada duplikatu (patrz "Critical Implementation Details" — sprawdzenie po `person_id` + `fight_id` + `role` + przeciwny `corner`, 409 jeśli znaleziono). `INSERT` dodaje kolumnę `corner`.

#### 3. Odczyt w Manager API

**File**: `server/api/manager/events/[id].get.ts`

**Intent**: Zwrócić `hasCorner` per wymaganie i `corner` per przypisanie, żeby frontend mógł grupować.

**Contract**: `SELECT` dla `fight_requirements` (linie 24-32) dodaje `has_corner AS hasCorner`; `SELECT` dla fight-level `assignments` (linie 35-48) dodaje `a.corner`.

#### 4. Walidacja publikacji per-narożnik

**File**: `server/api/manager/events/[id]/publish.post.ts`

**Intent**: Dla ról narożnikowych sprawdzić każdy narożnik osobno (`count/2` w każdym), nie tylko sumę.

**Contract**: Pętla per-walka (linie 36-52) — dla każdego `req` z `fight_requirements` teraz zawierającego `hasCorner`: jeśli `hasCorner`, wykonać DWA zapytania `COUNT(*) FROM assignments WHERE fight_id = ? AND role = ? AND corner = 'red'|'blue'`, porównać każde z `req.count / 2`, i dla każdego niedopełnionego narożnika dodać osobny komunikat błędu (np. `Walka #1: brakuje ${req.role} w czerwonym narożniku (X/${req.count / 2})`). Jeśli `!hasCorner`, zachować istniejącą logikę sumaryczną bez zmian.

### Success Criteria:

#### Automated Verification:

- TypeScript kompiluje się bez błędów: `npm run build`
- Lint czysty na zmienionych plikach

#### Manual Verification:

- Żadna (czysto backendowe, w pełni weryfikowalne API-wise w Fazie 4)

**Implementation Note**: Przejdź bezpośrednio do Fazy 3.

---

## Phase 3: Frontend — Manager (czerwony/niebieski/inne) i Personel (prefiks)

### Overview

Manager widzi dwie stylizowane sekcje narożników + sekcję "INNE". Personel widzi prefiks tekstowy przy rolach narożnikowych.

### Changes Required:

#### 1. Manager UI — sekcje narożników

**File**: `app/pages/manager/events.vue`

**Intent**: Zamiast jednej listy wymagań per walka, podzielić na czerwony narożnik, niebieski narożnik, i resztę ("INNE").

**Contract**: `FightRequirement` interfejs dostaje `hasCorner: boolean`; `FightAssignment` dostaje `corner: 'red' | 'blue' | null`. Nowe funkcje: `getCornerSlotPersonId(fight, role, corner, slotIndex)` i `handleCornerSlotChange(fight, role, corner, slotIndex, personId)` (analogiczne do istniejących `getFightSlotPersonId`/`handleFightSlotChange`, ale filtrujące `fight.assignments` dodatkowo po `corner`), oraz `availableForCornerSlot(fight, role, corner, slotIndex)` (analogiczne do `availableForFightSlot`, wykluczające dodatkowo osoby przypisane do PRZECIWNEGO narożnika tej samej roli w tej walce — patrz blokada w Fazie 2). Template: `fight.requirements.filter(r => r.hasCorner)` renderowane w dwóch blokach (czerwony/niebieski, każdy `count/2` slotów), `fight.requirements.filter(r => !r.hasCorner)` renderowane jak dziś pod etykietą "INNE". Styl: `.corner-red`/`.corner-blue` — ramka + tło w odcieniu czerwieni/błękitu, label "CZERWONY NAROŻNIK"/"NIEBIESKI NAROŻNIK" (wzorem istniejących `.section-label`/`.req-block`).

#### 2. Personel API — surfacing corner

**File**: `server/api/personel/events/[id].get.ts`

**Intent**: Udostępnić `corner` (i stabilny identyfikator wiersza dla poprawnego `:key` w UI) per przypisanie w walce.

**Contract**: `SELECT` dla fight-level assignments (linie 47-57) dodaje `a.corner` i `a.id AS assignmentId`; `FightPerson` w zwracanym JSON dostaje pola `corner` i `assignmentId`.

#### 3. Personel UI — prefiks narożnika

**File**: `app/pages/personel/schedule.vue`

**Intent**: Rola narożnikowa pokazuje się z prefiksem "CZERWONY: "/"NIEBIESKI: " przed nazwą roli.

**Contract**: `FightPerson` interfejs dostaje `corner: string | null` i `assignmentId: string`. Template (linia ~147): `:key` zmienia się z `person.role + person.personName` na `person.assignmentId` (stabilne, naprawia potencjalną kolizję kluczy). Wyświetlanie roli: `{{ person.corner === 'red' ? 'CZERWONY: ' : person.corner === 'blue' ? 'NIEBIESKI: ' : '' }}{{ person.role }}`.

### Success Criteria:

#### Automated Verification:

- TypeScript kompiluje się bez błędów: `npm run build`
- Lint czysty na zmienionych plikach

#### Manual Verification:

- Manager → walka z rolą narożnikową: dwie stylizowane sekcje (czerwona/niebieska) + sekcja "INNE" z pozostałymi rolami
- Manager → przypisanie tej samej osoby do obu narożników tej samej roli → błąd, nie zapisuje się
- Personel → szczegóły gali/walki: rola narożnikowa ma prefiks "CZERWONY:"/"NIEBIESKI:"

**Implementation Note**: Po zakończeniu tej fazy i przejściu automated verification — poczekaj na potwierdzenie manualnej weryfikacji przed przejściem do Fazy 4.

---

## Phase 4: Testy — nowe scenariusze + pełna regresja

### Overview

Trzy nowe/rozszerzone testy integracyjne pokrywające nową logikę, plus pełna regresja istniejącego zestawu.

### Changes Required:

#### 1. Test walidacji corner

**File**: `server/api/manager/assignments/assignments.boxer-conflict.integration.test.ts` (rozszerzyć istniejący plik — dotyczy tego samego endpointu) lub nowy plik `server/api/manager/assignments/assignments.corner.integration.test.ts`

**Intent**: Pokryć trzy nowe zachowania endpointu `POST /api/manager/assignments`.

**Contract**: Trzy nowe `it()`: (1) POST bez `corner` dla roli z `hasCorner=true` → 400; (2) POST z `corner` dla roli z `hasCorner=false` → 400; (3) POST z prawidłowym `corner` dla roli narożnikowej → 201.

#### 2. Test blokady duplikatu

**File**: to samo co powyżej

**Intent**: Ta sama osoba nie może być w obu narożnikach tej samej roli tej samej walki.

**Contract**: `it()`: przypisz osobę jako `Trener`/`corner=red` do walki, spróbuj przypisać tę samą osobę jako `Trener`/`corner=blue` do TEJ SAMEJ walki → 409.

#### 3. Test publikacji per-narożnik

**File**: `server/api/manager/events/events.publish-guard.integration.test.ts`

**Intent**: Publikacja blokuje się gdy jeden narożnik nie ma wypełnionej roli narożnikowej, mimo że drugi ma.

**Contract**: Nowy `it()`: stworzyć walkę z rolą narożnikową wymagającą 1+1, wypełnić TYLKO czerwony narożnik, opublikować → 422 z komunikatem wskazującym brakujący niebieski narożnik. Wymaga w teście stworzenia roli testowej z `hasCorner=true` przez Admin API (albo modyfikacji dictionary wprost przez SQL w setupie testu, zgodnie z istniejącym wzorcem `test/fixtures/seed.sql`).

### Success Criteria:

#### Automated Verification:

- Nowe/rozszerzone testy przechodzą: `npx vitest run --project integration server/api/manager/assignments/ server/api/manager/events/events.publish-guard.integration.test.ts`
- Cały zestaw testów integracyjnych przechodzi bez regresji: `npm run test:integration` (weryfikacja sekwencyjna `--no-file-parallelism` jeśli równoległy przebieg jest flaky, zgodnie z ustalonym wzorcem z tej sesji)
- TypeScript kompiluje się bez błędów: `npm run build`

#### Manual Verification:

- Brak regresji w Admin/Manager/Personel UI po wszystkich 4 fazach

**Implementation Note**: Po zakończeniu tej fazy i przejściu automated verification — poczekaj na potwierdzenie manualnej weryfikacji przed zamknięciem zmiany.

---

## Testing Strategy

### Integration Tests:

- Walidacja `corner` wymagany/zabroniony w zależności od `hasCorner` roli (Phase 4)
- Blokada duplikatu osoby w obu narożnikach tej samej roli/walki (Phase 4)
- Publikacja blokowana gdy jeden narożnik niewypełniony, mimo że suma się zgadza (Phase 4)
- Regresja: cały istniejący zestaw (RBAC, boxer-conflict, session-revalidation, personnel-schedule-view, publish-guard) nadal przechodzi

### Manual Testing Steps:

1. Admin → Słowniki → zaznacz "NAROŻNIK" dla Trener, ustaw count=2 → zapisz
2. Spróbuj ustawić count=3 z zaznaczonym narożnikiem → błąd
3. Manager → nowa gala → dodaj walkę → sprawdź że sekcja CZERWONY NAROŻNIK i NIEBIESKI NAROŻNIK pokazują po 1 polu Trener, reszta ról w sekcji INNE
4. Przypisz tę samą osobę jako Trener do obu narożników → błąd
5. Wypełnij tylko czerwony narożnik, spróbuj opublikować → błąd wskazujący niebieski narożnik
6. Uzupełnij niebieski → publikacja przechodzi
7. Personel → sprawdź że widzi "CZERWONY: [imię] — Trener" / "NIEBIESKI: [imię] — Trener"

## Migration Notes

Migracja `0006_fight_corner_assignment.sql` aplikowana najpierw lokalnie (`--local`), potem na produkcji (`wrangler d1 migrations apply ringabell --remote`) — ręczny krok użytkownika po zakończeniu całego planu, jak przy poprzednich migracjach w tej sesji. Bezpieczna do zastosowania w dowolnym momencie — nowe kolumny mają defaulty (`0`/`NULL`), zero wpływu na istniejące dane/zachowanie do momentu aż Admin faktycznie zaznaczy checkbox.

## References

- Wzorzec blokady konfliktu roli (bokser): `server/api/manager/assignments/index.post.ts:46-59`
- Wzorzec multi-slot: `app/pages/manager/events.vue:341-353` (`availableForFightSlot`)
- Wzorzec auto-copy: `server/api/manager/events/[id]/fights/index.post.ts:31-45`
- Wzorzec denormalizacji słownik→instancja: `migrations/0001_init.sql:37-42` (`fight_requirements.role`/`count` kopiowane z `fight_requirement_defaults`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Baza + Admin — has_corner, corner, checkbox w Słownikach

#### Automated

- [x] 1.1 Migracja aplikuje się bez błędów lokalnie: `wrangler d1 migrations apply ringabell --local`
- [x] 1.2 TypeScript kompiluje się bez błędów: `npm run build`
- [x] 1.3 Lint czysty na zmienionych plikach

#### Manual

- [ ] 1.4 Admin → Słowniki: checkbox "NAROŻNIK" działa, zapisuje się i wczytuje poprawnie — zweryfikowane przez API (POST/GET/PATCH, walidacja parzystości 400/201/200 zgodnie z oczekiwaniami), wygląd checkboxa w przeglądarce NIE zweryfikowany (user offline)
- [ ] 1.5 Ustawienie nieparzystej liczby z zaznaczonym narożnikiem pokazuje błąd, nie zapisuje się — backend zweryfikowany (400), komunikat w UI (`.form-error`) NIE zweryfikowany wizualnie

### Phase 2: Backend Manager — walidacja corner, auto-copy, publish per-narożnik

#### Automated

- [ ] 2.1 TypeScript kompiluje się bez błędów: `npm run build`
- [ ] 2.2 Lint czysty na zmienionych plikach

### Phase 3: Frontend — Manager (czerwony/niebieski/inne) i Personel (prefiks)

#### Automated

- [ ] 3.1 TypeScript kompiluje się bez błędów: `npm run build`
- [ ] 3.2 Lint czysty na zmienionych plikach

#### Manual

- [ ] 3.3 Manager → walka z rolą narożnikową: dwie stylizowane sekcje + sekcja "INNE"
- [ ] 3.4 Manager → przypisanie tej samej osoby do obu narożników tej samej roli → błąd
- [ ] 3.5 Personel → rola narożnikowa ma prefiks "CZERWONY:"/"NIEBIESKI:"

### Phase 4: Testy — nowe scenariusze + pełna regresja

#### Automated

- [ ] 4.1 Nowe/rozszerzone testy przechodzą
- [ ] 4.2 Cały zestaw testów integracyjnych przechodzi bez regresji
- [ ] 4.3 TypeScript kompiluje się bez błędów: `npm run build`

#### Manual

- [ ] 4.4 Brak regresji w Admin/Manager/Personel UI po wszystkich 4 fazach
