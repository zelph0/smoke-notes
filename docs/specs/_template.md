# Spec: <feature>

Status: draft

<!-- Written in an "interview me, then write the spec" session before building. The reviewer
agent checks the PR against this file. Keep it short; behaviour, not implementation. -->

## Problem

Who needs this, and why now?

## Behaviour

- What the user can do, step by step, including validation rules and limits.
- States: loading, empty, error, and anything else.

## Authorization

Who can see and change what. How data is scoped (by default: `ownerId = viewer.id`).

## Definition of done

- [ ] …
- [ ] Owner-scoped data access + an authorization test
- [ ] Loading, empty and error states
- [ ] Unit + integration + Playwright tests for the main flow
- [ ] Migration follows expand/contract (if the schema changes)

## Out of scope

## Open questions
