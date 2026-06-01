# Route Subtype Timeline Plan

## Goal

Add explicit subtypes for broad `review` and `verify` routes so the engineering agent can distinguish diff review, architecture review, security review, build verification, test verification, lint verification, and typecheck verification.

## Scope

- Add optional `subtype` to `EngineeringAgentRouteDecision`.
- Infer subtype from user request text and classification.
- Include subtype in `route_decided` turn events.
- Show subtype in transcript timeline route summaries.
- Keep required capabilities unchanged in this phase.

## Non-goals

- Do not add new specialized review runners yet.
- Do not change pipeline stage behavior beyond metadata.
- Do not add UI components.

## Success Criteria

1. Review requests infer `diff`, `architecture`, `security`, or `performance` subtype.
2. Verify requests infer `build`, `test`, `lint`, or `typecheck` subtype.
3. Route decision events and transcript timeline show subtype.
4. Existing route behavior remains compatible.
