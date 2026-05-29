---
change_id: mongo-connection-timeout
title: Fix MongoDB connection hang on Workers — serverSelectionTimeoutMS doesn't interrupt V8 isolate network ops
status: implementing
created: 2026-05-29
updated: 2026-05-29
archived_at: null
---

## Notes

serverSelectionTimeoutMS nie przerywa wiszącej operacji sieciowej na V8 isolates — Worker wisi i zostaje zabity przez runtime zamiast rzucić timeout error
