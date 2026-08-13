# Unify Personnel Dictionary — Plan Brief

> Full plan: `context/changes/unify-personnel-dictionary/plan.md`

## What & Why

Usuwamy event-level dictionary (dwie kolumny w Admin, sekcja "OBSŁUGA GALI" w Managerze) dodane kilka godzin wcześniej w tej samej sesji. Powód: UI na poziomie gali nie wspiera `count > 1` (realny bug blokujący publikację) i dwie kolumny obok siebie w tym samym wierszu tworzą ryzyko pomyłki przy wypełnianiu słownika. Decyzja: nie naprawiać, tylko wrócić do jednego, prostszego modelu — Ratownik i Konferansjer są zwykłymi rolami personelu, konfigurowanymi per walka, tak jak Bokser/Trener/Cutman.

## Starting Point

Dwa równoległe słowniki (`fight_requirement_defaults` per walka, `event_requirement_defaults` per gala), dwie kolumny w Admin → Słowniki, dwie sekcje w Managerze (WALKI + OBSŁUGA GALI). Nic z tego nie trafiło na produkcję — bezpieczne do wycofania. Realne dane produkcyjne z PRZED tej sesji istnieją (Ratownik/Konferansjer były hardkodowane jako event-level dawno temu) — te dane zostają w bazie nietknięte, tylko znikają z UI.

## Desired End State

Jeden słownik, jedna kolumna, jedna sekcja. Ratownik/Konferansjer pojawiają się jako wymagania konkretnej walki, dziedziczą automatycznie pełne wsparcie multi-slot z istniejącego mechanizmu (bez dodatkowego kodu). Publikacja gali blokuje się przez tę samą generyczną pętlę per-walka co każda inna rola.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Tabele event-level | DROP TABLE (nowa migracja) | Czysto, zero martwego schematu; nic na produkcji do tego nie odwołuje | Plan (pytanie do użytkownika) |
| Stare przypisania `type='event'` | Zostają w bazie, znikają z UI | Zero ryzyka utraty danych; historyczne gale i tak są głównie już opublikowane | Plan (pytanie do użytkownika) |
| Seed fight-level | Ratownik=1, Konferansjer=1 per walkę | Dokładnie "tak samo jak reszta personelu" — zero specjalnego traktowania | Plan (pytanie do użytkownika) |

## Scope

**In scope:** nowa migracja (seed + backfill + drop), usunięcie API/backend/frontend event-level, przebudowa jednego testu, pełna regresja.

**Out of scope:** migracja starych `type='event'` assignments na `type='fight'`, mechanizm "skopiuj osobę do wszystkich walk", naprawa buga multi-slot z `event-level-multi-slot` (staje się nieaktualny), zastosowanie migracji na produkcji (ręczny krok użytkownika później).

## Architecture / Approach

Jeden słownik (`fight_requirement_defaults` → `fight_requirements`) obsługuje wszystkie role. Kolejność faz: baza → backend → frontend → testy — odwrotność tego, jak budowaliśmy usuwaną funkcję.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Migracja | seed + backfill + drop tabel event-level | Backfill musi trafić każdą istniejącą walkę, inaczej stare draft-gale "gubią" wymóg |
| 2. Backend | usunięcie API/auto-copy/walidacji event-level | Publish.post.ts musi wrócić do 2 kroków, nie 3 |
| 3. Frontend | jedna kolumna, jedna sekcja | Manualna weryfikacja UI wymagana |
| 4. Testy | przebudowany test + pełna regresja | Test musi celować w fight-level, nie event-level |

**Prerequisites:** żadne — wszystko lokalne, nic na produkcji do koordynacji.
**Estimated effort:** ~1 sesja, 4 małe fazy.

## Open Risks & Assumptions

- Zakładamy, że nikt nie potrzebuje UI-widoku historycznych `type='event'` przypisań Ratownika/Konferansjera z przed tej sesji — jeśli to się okaże potrzebne, dane wciąż są w bazie, tylko trzeba by dopisać osobny (readonly) widok.

## Success Criteria (Summary)

- Admin → Słowniki: jedna kolumna, Ratownik/Konferansjer jak każda inna rola.
- Manager → gala: Ratownik/Konferansjer wymagane per walka, multi-slot działa od razu.
- Publikacja blokuje się identycznym mechanizmem dla każdej roli, bez wyjątków.
