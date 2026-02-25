export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export class NotFoundDomainError extends DomainError {
  constructor(message: string) {
    super(message, "NOT_FOUND", 404);
    this.name = "NotFoundDomainError";
  }
}

export class InvalidOperationDomainError extends DomainError {
  constructor(message: string) {
    super(message, "INVALID_OPERATION", 422);
    this.name = "InvalidOperationDomainError";
  }
}

export class ValidationDomainError extends DomainError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR", 400);
    this.name = "ValidationDomainError";
  }
}

export class ConflictDomainError extends DomainError {
  constructor(message: string) {
    super(message, "CONFLICT", 409);
    this.name = "ConflictDomainError";
  }
}
