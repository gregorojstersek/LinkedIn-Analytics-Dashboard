# VERITY.md — Quality Gate

> This project uses [Verity](https://verity.md) to enforce quality and security standards on AI-generated code.

**Project:** linkedin-analytics-dashboard
**Standard:** v1
**Mode:** local-only (run `verity auth register` to unlock history and reports)

## Quality Dimensions
- Comprehensibility (file length ≤300 lines, complexity ≤15, function length ≤50 lines)
- Modularity (single responsibility, shallow abstractions)
- Type Safety (strict equality, typeof guards, null checks — AI-assessed)
- Test Adequacy (coverage ≥80%, test quality)

## Security Patterns
- No hardcoded secrets (CWE-798) — Trivy + Semgrep
- Input sanitization / XSS prevention (CWE-20, CWE-80) — Semgrep
- Parameterized queries / no SQL injection (CWE-89) — Semgrep
- Dependency vulnerability scanning (CWE-1395) — Trivy
- No unsafe deserialization (CWE-502) — AI
- Access control checks (CWE-639) — AI
- Config file integrity (CWE-15) — AI

## Project-Specific Patterns
- No dynamic innerHTML in Chrome extension content scripts (XSS risk)
- Server file paths must be resolved from project root only (path traversal risk)
- No LinkedIn session cookies or tokens in source code or data files

## How It Works
Every time the coding agent stops, the Verity hook:
1. Runs static analysis via @codacy/analysis-cli (ESLint9 + Semgrep + Trivy)
2. Reviews findings against the Standard
3. Returns PASS / WARN / FAIL with actionable findings
