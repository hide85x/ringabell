# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Używaj formatDate() i nowUtc() z utils/date.ts

- **Context**: Każde miejsce w kodzie które obsługuje daty.
- **Problem**: Agent używa new Date().toISOString() lub ręcznego formatowania zamiast helpera — rozbite formaty dat w różnych miejscach aplikacji, brak UTC.
- **Rule**: Używaj formatDate() i nowUtc() z utils/date.ts. Nigdy nie używaj new Date().toISOString() ani ręcznego formatowania dat bezpośrednio w kodzie.
- **Applies to**: implement, impl-review

## Aktualizuj roadmap.md przy każdym implemented change

- **Context**: Każdy change który osiąga status `implemented` lub `impl_reviewed`.
- **Problem**: Agent zamyka change (commituje, ustawia status implemented) bez aktualizacji roadmap.md — status slajda zostaje `proposed`, outcome może zawierać stale technologie (Mongoose zamiast mongodb driver, Cloudflare Pages zamiast Workers). Użytkownik musi sam zauważyć i przypomnieć agentowi.
- **Rule**: Po ustawieniu `status: implemented` w change.md — zawsze zaktualizuj roadmap.md: zmień status slice'a na `ready`, popraw outcome i unknowns jeśli implementacja odbiega od pierwotnego opisu (inna biblioteka, inna platforma, rozwiązane unknowns).
- **Applies to**: implement, impl-review
