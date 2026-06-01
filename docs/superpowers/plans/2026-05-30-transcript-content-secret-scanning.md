# Transcript Content Secret Scanning Plan

## Goal

Extend transcript payload policy beyond key-based redaction by scanning string content for common secret patterns.

## Implementation

1. Add `TranscriptSecretPattern` configuration.
2. Add default content scanners for:
   - JWT-like tokens
   - OpenAI-style `sk-` keys
   - GitHub tokens
   - AWS access keys
   - PEM private key blocks
3. Run content redaction before length truncation.
4. Record `secret_redacted` actions with matched pattern names.
5. Keep caller override via `secretPatterns`.

## Non-goals

- No exhaustive enterprise DLP scanner.
- No entropy-based detector in this iteration.
- No UI rendering changes.

## Success Criteria

1. `npm run build` passes.
2. Default policy redacts common secret content in strings.
3. Policy actions report pattern matches.
4. Existing key-based redaction and payload budget behavior remain intact.
