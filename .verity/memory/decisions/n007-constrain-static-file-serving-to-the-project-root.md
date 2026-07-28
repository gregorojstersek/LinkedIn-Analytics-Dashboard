---
schema: 1
id: n007-constrain-static-file-serving-to-the-project-root
kind: decision
title: "Constrain static file serving to the project root"
domains: ["security", "server", "static-files"]
file_globs: []
confidence: 0.92
status: active
source: extractor
created_by: decision-promoter@gpt-5.4-mini
created_at: 2026-07-28T09:04:57.718151+00:00
updated_at: 2026-07-28T09:04:57.672+00:00
related: []
supersedes: []
superseded_by: null
contradicts: []
caused_by: []
example_of: []
---

# Constrain static file serving to the project root

Static asset serving must resolve only within the project root so request paths cannot escape into arbitrary filesystem locations. This is a security constraint, not just an implementation choice: allowing broader roots or unchecked path joins would reintroduce traversal risk and bypass the custom server-path safety guard. Apply this rule anywhere server code maps URL paths to disk paths or exposes files over HTTP.
