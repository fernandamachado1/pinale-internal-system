# DDD Module Template

Use this template when creating a new domain module.

## Suggested structure

```text
server/
  domain/
    entities/
      <module-entity>.ts
    value-objects/
      <module-vo>.ts
    services/
      <module-domain-service>.ts
    errors/
      domain-error.ts

  application/
    contracts/
      <module>-repository.ts
    use-cases/
      create-<module>-use-case.ts
      list-<module>-use-case.ts
      update-<module>-use-case.ts

  infra/
    repositories/
      <module>-repository.ts

  interfaces/
    http/
      <module>-controller.ts
```

## Creation checklist

- Define ubiquitous language and module vocabulary.
- Create entities/value objects with invariants first.
- Define repository contract used by use cases.
- Implement use cases with transaction boundaries.
- Implement infra repository and mapping.
- Add tests for:
  - domain invariants
  - use-case orchestration
  - repository integration (if project has integration tests)

## Pull request checklist

- No forbidden import direction.
- No business rule duplicated in controller/infra.
- Domain errors mapped correctly at interface boundary.
- Shared schema/DTO does not leak infra details.
