---
change_id: data-scaffold
title: Data scaffold — MongoDB driver connected to Atlas with base models
status: implemented
created: 2026-05-29
updated: 2026-05-29
archived_at: null
---

## Notes

F-02 from roadmap. F-01 (auth-scaffold) is implemented. Remaining work: install mongoose, connect to MongoDB Atlas, define base models: User (extended with role + profile), Person (personnel base), Event (gala), Fight (walka), Assignment (personnel-to-fight/event). Verify connection via /healthz endpoint. See @context/foundation/roadmap.md §F-02.
