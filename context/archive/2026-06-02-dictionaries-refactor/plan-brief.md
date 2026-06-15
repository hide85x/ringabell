# Dictionaries UI Refactor — Plan Brief

> Full plan: `context/changes/dictionaries-refactor/plan.md`

## What & Why

Refactor UI słowników po S-02 — redundantna sekcja WYMAGANIA WALK duplikuje dane z tabeli ROLE. Użytkownik nie rozumiał różnicy między dwiema sekcjami. Łączymy je w jedną tabelę, dodajemy powrót do home w AdminNav i poprawiamy efekt hover na buttonach.

## Starting Point

`dictionaries.vue` ma 2 osobne sekcje z oddzielnymi tabelami i 4 modalami. AdminNav nie ma linku powrotu. Buttony używają `skewX` który na hover daje efekt lustra.

## Desired End State

Jedna tabela ROLE z kolumnami NAZWA | MIN. NA WALKĘ | EDIT. Modal dodawania/edycji roli zawiera oba pola naraz. AdminNav ma link 🔔 WRÓĆ. Hover na buttonach = `rotate(-2deg)` (subtelny tilt, bez flipa).

## Key Decisions Made

| Decision | Choice | Why |
|---|---|---|
| Merge tabel | Jedna tabela ROLE | Dwie tabele pokazywały te same dane — UX confusion |
| Count w modalu | Opcjonalne przy dodawaniu | Można najpierw stworzyć rolę, count ustawić później |
| Brak count | Szary "BRAK" | Wyraźniejszy sygnał że warto ustawić |
| Hover transform | rotate(-2deg) | Bez efektu lustra (skewX flip) |
| Back button | 🔔 WRÓĆ w AdminNav | Spójny z designem, łatwo dostępny |

## Scope

**In scope:** dictionaries.vue, AdminNav.vue, users.vue (transforms), index.vue (transforms)

**Out of scope:** API, DB, roadmap.md, endpointy requirements (zostają)

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. UI refactor | Merge tabel + back btn + rotate | Logika upsert/delete requirement w modalu |

**Prerequisites:** S-02 zaimplementowany (done)

## Success Criteria

- Jedna tabela na `/admin/dictionaries` z kolumną MIN. NA WALKĘ
- 🔔 WRÓĆ w AdminNav prowadzi do `/`
- Hover na buttonach: subtelny rotate bez efektu lustra
