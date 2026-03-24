export class AppError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

