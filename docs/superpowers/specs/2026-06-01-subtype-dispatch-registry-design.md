# Subtype Dispatch Registry Design

## Goal

Make engineering route subtypes affect execution strategy instead of remaining metadata only.

## Scope

This phase introduces a dispatch registry that uses route subtype to select verification commands and review prompts.

## Behavior

### Verification subtypes

- `verify.build` -> build verification only
- `verify.test` -> test verification only
- `verify.lint` -> lint verification only
- `verify.typecheck` -> typecheck verification only

If no subtype is provided, the existing command selection behavior remains unchanged.

### Review subtypes

- `review.diff` -> default diff review prompt
- `review.architecture` -> architecture-focused review prompt
- `review.security` -> security-focused review prompt
- `review.performance` -> performance-focused review prompt

If no subtype is provided, the existing review prompt behavior remains unchanged.

## Architecture

Add a small dispatch layer in the engineering runtime:

- `resolveVerificationCommandsForSubtype(...)`
- `buildReviewPromptForSubtype(...)`

These helpers will be used inside `EngineeringExecutionPipeline` so that subtype decisions affect execution without introducing new external models or background workers.

## Non-goals

- Do not add multi-model reviewer workers.
- Do not add Always-on routing.
- Do not change route classification rules in this phase.
- Do not add UI changes.

## Success Criteria

1. Verification subtypes select the expected command set.
2. Review subtypes select the expected prompt variant.
3. Existing behavior remains unchanged when subtype is absent.
4. Timeline and transcript continue to show the route decision subtype.
