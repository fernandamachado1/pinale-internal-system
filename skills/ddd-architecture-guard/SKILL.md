---
name: ddd-architecture-guard
description: Use when the task involves designing, reviewing, refactoring, or scaffolding backend code with Domain-Driven Design boundaries (domain, application, infrastructure, interfaces), enforcing dependency rules, aggregate invariants, repository contracts, and transaction orchestration.
---

# DDD Architecture Guard

Use this skill for structural work in DDD-oriented codebases, not only for a single use case.

## When to apply

- Creating a new module/bounded context
- Refactoring for cleaner layer boundaries
- Reviewing PRs for architectural violations
- Adding domain logic (entities, aggregates, value objects, domain services)
- Wiring repositories, transactions, and application services

## Execution flow

1. Map impacted files and classify each one as `domain`, `application`, `infrastructure`, or `interfaces`.
2. Run `scripts/architecture-check.sh` to identify obvious boundary/import violations.
3. Apply rules from `references/ddd-rules.md` to decide target structure.
4. For new modules, scaffold from `references/module-template.md`.
5. Validate:
   - Domain has no infra/framework imports.
   - Application orchestrates use cases without embedding persistence details.
   - Infra implements contracts from application/domain only.
6. Report changes and remaining risks.

## Hard guardrails

- Do not import infra code from domain or application.
- Keep business invariants inside domain objects.
- Keep transaction boundaries in application layer.
- Use repository interfaces (contracts) outside infrastructure.
- Avoid leaking ORM/HTTP/database types into domain.

## References

- Rules and anti-patterns: `references/ddd-rules.md`
- Module template and file checklist: `references/module-template.md`
- Quick static audit: `scripts/architecture-check.sh`
