# DDD Rules

## Layer responsibilities

- `domain`: business model and rules (entities, value objects, aggregates, domain services, domain errors).
- `application`: use cases, transaction orchestration, repository contracts, DTO mapping.
- `infrastructure`: implementations for persistence, transport, external services.
- `interfaces`: controllers/routes/handlers and presentation adapters.

## Dependency direction

Allowed:

- `interfaces -> application`
- `application -> domain`
- `infrastructure -> application` (contracts) and `infrastructure -> domain` (mapping only)

Disallowed:

- `domain -> application|infrastructure|interfaces`
- `application -> interfaces`
- `application -> concrete infra implementations`

## Aggregate and invariants

- Put invariant checks in aggregate/entity methods.
- Do not bypass aggregate methods by mutating state externally.
- Use domain errors for rule violations.
- Keep identifiers and core types stable and explicit.

## Repositories and transactions

- Define repository interfaces in `application/contracts` (or `domain/repositories` if preferred and consistent).
- Infra implements interfaces; use cases depend on interfaces only.
- Open and close transactions in application use cases, not in domain.
- Persist aggregate state changes atomically when required by business rules.

## Anti-patterns checklist

- Domain object importing DB/ORM package.
- Use case creating SQL queries directly.
- HTTP/controller payload used directly as domain model.
- Domain method returning framework/ORM objects.
- Cross-module calls that bypass aggregate boundaries.
