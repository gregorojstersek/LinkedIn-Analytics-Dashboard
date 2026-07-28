---
schema: 1
id: n006-keep-server-modules-import-safe-by-gating-startup
kind: decision
title: "Keep server modules import-safe by gating startup and DOM side effects"
domains: ["testing", "server-runtime", "browser-compat"]
file_globs: []
confidence: 0.91
status: active
source: extractor
created_by: decision-promoter@gpt-5.4-mini
created_at: 2026-07-28T09:04:36.961539+00:00
updated_at: 2026-07-28T09:04:36.935+00:00
related: []
supersedes: []
superseded_by: null
contradicts: []
caused_by: []
example_of: []
---

# Keep server modules import-safe by gating startup and DOM side effects

Server-side modules must be safe to import in Node tests without starting the production listener or attaching browser DOM handlers. Use `typeof document` checks for browser-only code and main-module guards for startup code so test imports can exercise logic directly. This is a hard constraint because import-time side effects would make built-in Node tests flaky and could accidentally boot the app during verification or other non-browser execution.
