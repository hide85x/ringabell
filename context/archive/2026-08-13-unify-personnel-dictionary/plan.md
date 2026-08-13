# Unify Personnel Dictionary Implementation Plan

## Overview

Usuwamy event-level dictionary (`event_requirement_defaults`/`event_requirements`, kolumna "MIN. NA GALĘ" w Admin, sekcja "OBSŁUGA GALI" w Managerze) — wprowadzone kilka godzin wcześniej w tej samej sesji w zmianie `event-level-requirements-dictionary`. Ratownik i Konferansjer wracają do bycia zwykłymi rolami personelu, konfigurowanymi w tym samym jednym słowniku co Bokser/Trener/Cutman/Sędzia (`fight_requirement_defaults`), przypisywanymi per walka.

## Current State Analysis

Po `event-level-requirements-dictionary` (commit `9b40040` + wcześniejsze `af79ebc`, `d846a9a`, wszystko TYLKO lokalnie, nic nie trafiło na produkcję):

- Dwa równoległe słowniki: `fight_requirement_defaults` (per walka) i `event_requirement_defaults` (per gala), każdy z własną kolumną w Admin → Słowniki.
- Manager ma dwie sekcje przy edycji gali: "WALKI" (multi-slot, w pełni wspiera `count > 1`) i "OBSŁUGA GALI" (single-select, NIE wspiera `count > 1` — patrz `context/changes/event-level-multi-slot/research.md`, ten bug nie zostanie naprawiony, bo cała koncepcja event-level jest usuwana).
- `publish.post.ts` waliduje osobno: per-walka (pętla generyczna po `fight_requirements`) i per-gala (pętla generyczna po `event_requirements`, dodana w fazie 3 poprzedniej zmiany).
- Ratownik/Konferansjer istnieją w `person_roles` od migracji `0004` (a faktycznie już wcześniej na produkcji, bo były hardkodowane jako event-level jeszcze PRZED tą sesją).
- Realne dane produkcyjne: przypisania `assignments` z `type='event'`, `role IN ('Ratownik','Konferansjer')` istnieją z czasów PRZED tą sesją (hardkodowany event-level UI istniał od dawna). Migracja `0004` (event-level dictionary) NIE trafiła na produkcję, ale sam hardkodowany event-level UI i jego dane — TAK, są realne.

### Key Discoveries:

- Wzorzec multi-slot per-walka jest gotowy do skopiowania semantyki (nie kodu — usuwamy odpowiednik na poziomie gali, nie dodajemy nowego): `app/pages/manager/events.vue:490-509` (`v-for="req in fight.requirements"` → `v-for="slotIdx in req.count"`).
- `eventMissingRoles()` (`app/pages/manager/events.vue:251-259`) i cała infrastruktura event-level w `canPublish` — do usunięcia, nie do naprawienia.
- Backend walidacji per-walka (`server/api/manager/events/[id]/publish.post.ts:29-53`) jest już generyczny i nie wymaga zmian — Ratownik/Konferansjer automatycznie zaczną być tam sprawdzane, bo pętla iteruje po `fight_requirements` niezależnie od nazwy roli.
- `assignments` nie ma FK z `event_requirement_defaults`/`event_requirements` do innych tabel poza `events`/`person_roles` (obie z `ON DELETE CASCADE` we własną stronę) — `DROP TABLE` jest bezpieczny, nic innego na nie nie wskazuje.
- Personel-facing endpointy (`server/api/personel/events/[id].get.ts`, `server/api/personel/events/index.get.ts`) czytają `assignments` generycznie (bez rozróżnienia źródła `type='event'` vs `type='fight'` przy budowaniu listy ról) — nie wymagają zmian, będą nadal poprawnie wyświetlać zarówno stare (`type='event'`), jak i nowe (`type='fight'`) przypisania Ratownika/Konferansjera.

## Desired End State

Jeden słownik (`fight_requirement_defaults`) obejmujący wszystkie role personelu, łącznie z Ratownikiem i Konferansjerem. Admin → Słowniki ma jedną kolumnę liczby ("MIN. NA WALKĘ"). Manager przy edycji gali widzi tylko sekcję "WALKI" — Ratownik/Konferansjer pojawiają się jako kolejne wymagania w każdej walce, z pełnym wsparciem multi-slot (dziedziczonym bezpłatnie z istniejącego mechanizmu). Publikacja gali blokuje się identycznie jak dla każdej innej roli — przez generyczną pętlę per-walka, bez żadnego specjalnego kroku dla Ratownika/Konferansjera.

Weryfikacja: nowa gala z 1 walką automatycznie wymaga 1 Ratownika + 1 Konferansjera na TĘ walkę (widoczne w sekcji WALKI, nie w osobnej sekcji). Stare przypisania `type='event'` zostają w bazie nietknięte (widoczne tylko przez SQL, nie przez UI — patrz "Co NIE robimy").

## What We're NOT Doing

- Nie migrujemy istniejących przypisań `type='event'` (Ratownik/Konferansjer) na `type='fight'` — zostają w bazie, po prostu nie są już wyświetlane w żadnym UI. Historyczne gale "zapominają" wizualnie kto był ratownikiem, dane fizycznie nie są usuwane.
- Nie dodajemy żadnego mechanizmu "skopiuj tę samą osobę do wszystkich walk" — Manager wybiera Ratownika/Konferansjera osobno dla każdej walki, identycznie jak Trenera czy Cutmana. To świadoma decyzja (odpowiedź na pytanie "Seed" w tej sesji planowania).
- Nie naprawiamy buga z `context/changes/event-level-multi-slot/` (UI nie wspierał count>1 na poziomie gali) — staje się nieaktualny, bo cała koncepcja event-level znika. Ten change-id zostanie oznaczony jako superseded, nie zamknięty jako zaimplementowany.
- Nie dotykamy produkcyjnej bazy D1 w tym planie — migracja `0005` jest aplikowana tylko lokalnie (`--local`), tak jak `0004` przed nią. Zastosowanie na produkcji to osobny, ręczny krok użytkownika po zakończeniu całego planu.

## Implementation Approach

Kolejność: baza → backend → frontend → testy, symetrycznie do tego jak budowaliśmy `event-level-requirements-dictionary`, tylko w kierunku odwrotnym (usuwanie zamiast dodawania) plus jeden nowy seed. Migracja `0005` w jednym pliku robi trzy rzeczy na raz (seed + backfill + drop), bo są ze sobą logicznie związane i nie ma sensu rozbijać na osobne migracje.

## Phase 1: Migracja — seed + backfill + drop

### Overview

Jedna nowa migracja SQL: Ratownik/Konferansjer wchodzą do `fight_requirement_defaults` (count=1 każdy), istniejące walki dostają backfill `fight_requirements` dla tych dwóch ról (zachowanie identyczne z podejściem `0004` dla `event_requirements`), a `event_requirement_defaults`/`event_requirements` zostają usunięte.

### Changes Required:

#### 1. Nowa migracja

**File**: `migrations/0005_unify_personnel_dictionary.sql`

**Intent**: Przenieść Ratownika/Konferansjera z event-level do fight-level słownika i wycofać event-level tabele.

**Contract**: Trzy blokи w jednym pliku, w tej kolejności:
1. `INSERT INTO fight_requirement_defaults (id, role_id, count) SELECT lower(hex(randomblob(16))), id, 1 FROM person_roles WHERE name = 'Ratownik'` (analogicznie dla `'Konferansjer'`), każdy owinięty w `WHERE NOT EXISTS (SELECT 1 FROM fight_requirement_defaults WHERE role_id = (SELECT id FROM person_roles WHERE name = '<rola>'))` dla idempotencji. `person_roles` dla obu ról już istnieje (utworzone w `0004`, migracje są sekwencyjne) — nie trzeba ich ponownie seedować.
2. Backfill `fight_requirements` dla każdej istniejącej walki i każdej z dwóch ról, wzorem `CROSS JOIN`-podobnego backfillu z `0004:35-42`, ale per-fight: `INSERT INTO fight_requirements (id, fight_id, role, count) SELECT lower(hex(randomblob(16))), f.id, 'Ratownik', 1 FROM fights f WHERE NOT EXISTS (SELECT 1 FROM fight_requirements fr WHERE fr.fight_id = f.id AND fr.role = 'Ratownik')` (analogicznie dla `'Konferansjer'`).
3. `DROP TABLE event_requirement_defaults;` i `DROP TABLE event_requirements;` (indeksy `idx_event_req_defaults_role`/`idx_event_requirements_event_id` znikają automatycznie z tabelami).

### Success Criteria:

#### Automated Verification:

- Migracja aplikuje się bez błędów lokalnie: `wrangler d1 migrations apply ringabell --local`
- Po migracji: `fight_requirement_defaults` ma wpisy dla Ratownik(1) i Konferansjer(1) oprócz istniejących ról
- Po migracji: `SELECT COUNT(*) FROM event_requirement_defaults` i analogicznie dla `event_requirements` zwraca błąd "no such table" (tabele faktycznie usunięte)
- Każda istniejąca walka ma teraz w `fight_requirements` wpisy dla Ratownik i Konferansjer

#### Manual Verification:

- Żadna (czysto backendowe query, w pełni weryfikowalne automatycznie)

**Implementation Note**: Po zakończeniu tej fazy i przejściu automated verification — przejdź bezpośrednio do Fazy 2 (brak potrzeby manualnej weryfikacji, wszystko sprawdzalne zapytaniami SQL).

---

## Phase 2: Backend — usunięcie event-level API i walidacji

### Overview

Usunięcie wszystkich endpointów i logiki backendowej związanej z event-level dictionary. Publikacja wraca do dwóch kroków walidacji (co najmniej 1 walka + wymagania per-walka), bez trzeciego kroku event-level.

### Changes Required:

#### 1. Usunięcie Admin API dla event-requirements

**File**: `server/api/admin/dictionaries/event-requirements/` (cały katalog: `index.get.ts`, `index.post.ts`, `[id].patch.ts`, `[id].delete.ts`)

**Intent**: Te endpointy zarządzały słownikiem, który już nie istnieje.

**Contract**: Usunąć cały katalog.

#### 2. Usunięcie auto-copy przy tworzeniu gali

**File**: `server/api/manager/events/index.post.ts`

**Intent**: Gala nie kopiuje już `event_requirement_defaults` — ta tabela nie istnieje.

**Contract**: Usunąć blok "Auto-copy event_requirement_defaults" (zapytanie do `event_requirement_defaults` + pętla INSERT do `event_requirements`). Endpoint wraca do samego INSERT do `events` + `return`.

#### 3. Usunięcie odczytu eventRequirements

**File**: `server/api/manager/events/[id].get.ts`

**Intent**: Response nie zawiera już `eventRequirements` — front-end nie ma już sekcji, która by to konsumowała.

**Contract**: Usunąć blok zapytania "5b. Event requirements" i pole `eventRequirements` z obiektu zwracanego na końcu handlera.

#### 4. Uproszczenie walidacji publikacji

**File**: `server/api/manager/events/[id]/publish.post.ts`

**Intent**: Publikacja sprawdza już tylko to co sprawdzała przed `event-level-requirements-dictionary` — plus automatycznie Ratownika/Konferansjera, bo są teraz w `fight_requirements` i przechodzą przez już istniejącą generyczną pętlę per-walka.

**Contract**: Usunąć blok "3. Event-level: all required roles filled (dictionary-driven)" (zapytanie do `event_requirements` + pętla). Zostają tylko krok 1 (co najmniej 1 walka), krok 2 (pętla per-walka, bez zmian), i krok "4. Date conflicts" (przenumerować z powrotem na "3." dla konsekwencji numeracji komentarzy).

### Success Criteria:

#### Automated Verification:

- TypeScript kompiluje się bez błędów: `npm run build`
- Lint przechodzi (ESLint via Node 22, brak dedykowanego `npm run lint` — uruchomić `npx eslint` na zmienionych plikach)
- Testy integracyjne z poprzedniej fazy tego samego dnia nadal przechodzą tam gdzie nie dotyczą event-level (RBAC, boxer-conflict, session-revalidation, personnel-schedule-view) — pełny `npm run test:integration` uruchomiony po Fazie 4 (test publish-guard zostanie przebudowany w Fazie 4, więc tymczasowo może failować między Fazą 2 a 4)

#### Manual Verification:

- Żadna

**Implementation Note**: Przejdź bezpośrednio do Fazy 3.

---

## Phase 3: Frontend — usunięcie kolumny i sekcji

### Overview

Admin → Słowniki wraca do jednej kolumny liczby. Manager → edycja gali wraca do jednej sekcji "WALKI" — Ratownik/Konferansjer pojawiają się tam automatycznie jako kolejne wymagania.

### Changes Required:

#### 1. Admin dictionaries — usunięcie kolumny MIN. NA GALĘ

**File**: `app/pages/admin/dictionaries.vue`

**Intent**: Jedna kolumna liczby w tabeli ról, jedno pole liczby w modalu add/edit — dokładnie jak przed `event-level-requirements-dictionary`.

**Contract**: Usunąć: `useFetch` do `/api/admin/dictionaries/event-requirements` i `refreshEventRequirements`, `eventRequirementForRole()`, `addRoleEventCount` (deklaracja + reset w `openAddRole()` + użycie w `saveAddRole()`), `editRoleEventCount` (deklaracja + populate w `openEditRole()` + logika w `saveEditRole()` + `refreshEventRequirements()` w `saveEditRole()`/`deleteRole()`). W template: usunąć `<th>MIN. NA GALĘ</th>` i odpowiadający `<td>`, przywrócić `colspan="3"` na empty-row, usunąć pole "MIN. NA GALĘ (OPCJONALNE)" z obu modali (Add i Edit).

#### 2. Manager events — usunięcie sekcji OBSŁUGA GALI

**File**: `app/pages/manager/events.vue`

**Intent**: Ratownik/Konferansjer przestają mieć dedykowaną sekcję — stają się zwykłymi wymaganiami per-walka, renderowanymi przez już istniejący mechanizm `v-for="req in fight.requirements"`.

**Contract**: Usunąć: interfejs `EventRequirement`, pole `eventRequirements` z `EventDetail`, funkcje `getEventSlotPersonId`, `handleEventSlotChange`, `eventMissingRoles`, cały template block "Event-level assignments" (`<template v-if="eventDetail.eventRequirements.length">...</template>`, sekcja "OBSŁUGA GALI"). `canPublish` computed: usunąć `eventLevelValid` (i jego użycie w `return`), zostaje `allFightsValid && noConflicts` — identycznie jak przed `event-level-requirements-dictionary`.

### Success Criteria:

#### Automated Verification:

- TypeScript kompiluje się bez błędów: `npm run build`
- Lint czysty na zmienionych plikach

#### Manual Verification:

- Admin → Słowniki: jedna kolumna liczby, Ratownik/Konferansjer widoczne w tej samej tabeli co Bokser/Trener/etc.
- Manager → nowa gala → dodanie walki: Ratownik i Konferansjer widoczne jako wymagania TEJ walki (nie osobna sekcja)
- Manager → gala: brak sekcji "OBSŁUGA GALI" nigdzie w UI

**Implementation Note**: Po zakończeniu tej fazy i przejściu automated verification — poczekaj na potwierdzenie manualnej weryfikacji UI przed przejściem do Fazy 4.

---

## Phase 4: Testy — przebudowa i pełna regresja

### Overview

Test z fazy 4 poprzedniej zmiany (blokada publikacji bez ratownika/konferansjera na poziomie gali) przestał być trafny — event-level nie istnieje. Przebudowujemy go na wersję fight-level (dokładnie to co i tak sprawdza teraz generyczna pętla per-walka), plus pełna regresja całego zestawu.

### Changes Required:

#### 1. Przebudowa testu publish-guard

**File**: `server/api/manager/events/events.publish-guard.integration.test.ts`

**Intent**: Zachować pokrycie "brak wymaganej roli blokuje publikację", ale wycelowane w Ratownika/Konferansjera jako rolę PER-WALKĘ, nie event-level.

**Contract**: Zmienić test `'returns 422 with error message when a required event-level role (e.g. Ratownik) is missing'` — usunąć wywołanie `staffFight()` (albo wywołać je tylko dla ról INNYCH niż Ratownik/Konferansjer, jeśli test ma sprawdzać izolowanie tego jednego braku), zamiast tego stworzyć walkę i NIE przypisywać Ratownika (oraz opcjonalnie innych ról), sprawdzić 422 z komunikatem zawierającym `Ratownik` w formacie zgodnym z generyczną pętlą per-walka (`Walka #1: brakuje Ratownik (0/1)`, wzorem istniejącej asercji dla innych ról w tej pętli, `publish.post.ts:49`). Nazwa testu do zaktualizowania, żeby odzwierciedlała nowe zachowanie (np. `'... a required per-fight role (e.g. Ratownik) is missing'`). Funkcja pomocnicza `staffFight()` (dodana w poprzedniej zmianie) zostaje bez zmian — nadal przydatna do wypełniania WSZYSTKICH wymagań poza tą jedną rolą, którą test celowo pomija (wymaga małej modyfikacji: parametr wykluczający jedną rolę z wypełniania, albo osobna wersja pętli w tym teście).

### Success Criteria:

#### Automated Verification:

- Przebudowany test przechodzi: `npx vitest run --project integration server/api/manager/events/events.publish-guard.integration.test.ts`
- Cały zestaw testów integracyjnych przechodzi bez regresji: `npm run test:integration` (weryfikacja sekwencyjna `--no-file-parallelism` jeśli równoległy przebieg jest flaky, zgodnie z ustalonym wzorcem z tej sesji)
- TypeScript kompiluje się bez błędów: `npm run build`

#### Manual Verification:

- Brak regresji w Admin/Manager/Personel UI po wszystkich 4 fazach (ten sam punkt manualny, który i tak wisiał z poprzedniej, wycofywanej zmiany)

**Implementation Note**: Po zakończeniu tej fazy i przejściu automated verification — poczekaj na potwierdzenie manualnej weryfikacji przed zamknięciem zmiany.

---

## Testing Strategy

### Integration Tests:

- Publikacja blokowana gdy brakuje Ratownika/Konferansjera NA WALCE (przebudowany test, Phase 4)
- Regresja: cały istniejący zestaw (RBAC, boxer-conflict, session-revalidation, personnel-schedule-view) nadal przechodzi

### Manual Testing Steps:

1. Zastosuj migrację `0005` lokalnie, sprawdź że `event_requirement_defaults`/`event_requirements` nie istnieją, a `fight_requirement_defaults` ma Ratownik+Konferansjer
2. Admin → Słowniki → jedna kolumna liczby, widoczna dla wszystkich ról łącznie z Ratownik/Konferansjer
3. Manager → nowa gala → dodaj walkę → sprawdź że Ratownik/Konferansjer są wśród wymagań TEJ walki
4. Spróbuj opublikować bez Ratownika/Konferansjera → błąd w formacie `Walka #1: brakuje Ratownik (0/1)`
5. Uzupełnij → publikacja przechodzi
6. Sprawdź starą galę (z przypisaniem `type='event'` sprzed tej sesji) → wciąż się otwiera, wciąż widoczna dla Personelu, po prostu bez edytowalnej sekcji OBSŁUGA GALI w Managerze

## Migration Notes

Migracja `0005_unify_personnel_dictionary.sql` aplikowana tylko lokalnie w tym planie (`--local`). Migracja `0004` (event-level dictionary) NIGDY nie trafiła na produkcję — więc `0005` w praktyce "czyści" coś co istniało tylko lokalnie, PLUS realnie zmienia jak działają Ratownik/Konferansjer (które NA PRODUKCJI istnieją jako hardkodowany event-level UI, poza tym planem/migracjami). Zastosowanie `0005` na produkcji (`wrangler d1 migrations apply ringabell --remote`) — ręczny krok użytkownika po zakończeniu całego planu, jak zawsze w tej sesji.

## References

- Related research: `context/changes/event-level-multi-slot/research.md` (bug, który staje się nieaktualny po tym planie)
- Zmiana wycofywana: `context/changes/event-level-requirements-dictionary/plan.md`
- Wzorzec multi-slot per-walka (pozostaje, nie zmieniamy): `app/pages/manager/events.vue:490-509`
- Wzorzec backfillu z poprzedniej migracji: `migrations/0004_event_requirement_defaults.sql:35-42`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Migracja — seed + backfill + drop

#### Automated

- [x] 1.1 Migracja aplikuje się bez błędów lokalnie: `wrangler d1 migrations apply ringabell --local` — f08986f
- [x] 1.2 `fight_requirement_defaults` ma wpisy Ratownik(1)/Konferansjer(1) — f08986f
- [x] 1.3 `event_requirement_defaults`/`event_requirements` nie istnieją (DROP potwierdzony) — f08986f
- [x] 1.4 Każda istniejąca walka ma backfillowane `fight_requirements` dla obu ról — f08986f

### Phase 2: Backend — usunięcie event-level API i walidacji

#### Automated

- [x] 2.1 TypeScript kompiluje się bez błędów: `npm run build` — fa96898
- [x] 2.2 Lint czysty na zmienionych plikach — fa96898

### Phase 3: Frontend — usunięcie kolumny i sekcji

#### Automated

- [x] 3.1 TypeScript kompiluje się bez błędów: `npm run build` — 352bebd
- [x] 3.2 Lint czysty na zmienionych plikach — 352bebd

#### Manual

- [x] 3.3 Admin → Słowniki: jedna kolumna, Ratownik/Konferansjer widoczne jak reszta ról — 352bebd
- [x] 3.4 Manager → nowa walka: Ratownik/Konferansjer widoczne jako wymagania walki, brak sekcji OBSŁUGA GALI — 352bebd

### Phase 4: Testy — przebudowa i pełna regresja

#### Automated

- [x] 4.1 Przebudowany test przechodzi — 384a81b
- [x] 4.2 Cały zestaw testów integracyjnych przechodzi bez regresji — 384a81b
- [x] 4.3 TypeScript kompiluje się bez błędów: `npm run build` — 384a81b

#### Manual

- [x] 4.4 Brak regresji w Admin/Manager/Personel UI po wszystkich 4 fazach — 384a81b
