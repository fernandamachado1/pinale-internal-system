import { z } from "zod";
import { DomainError } from "../server/domain/errors/domain-error.ts";

export type ErrorResponse = {
  status: number;
  body: Record<string, unknown>;
};

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function toErrorResponse(err: unknown): ErrorResponse {
  if (err instanceof z.ZodError) {
    return {
      status: 400,
      body: {
        message: err.errors[0]?.message ?? "Validation error",
        field: err.errors[0]?.path.join("."),
        code: "VALIDATION_ERROR",
      },
    };
  }

  if (err instanceof ApiError) {
    return {
      status: err.status,
      body: err.code ? { message: err.message, code: err.code } : { message: err.message },
    };
  }

  if (err instanceof DomainError) {
    return {
      status: err.statusCode,
      body: { message: err.message, code: err.code },
    };
  }

  if (err instanceof Error) {
    const message = err.message?.trim() ? err.message : "Internal server error";
    const details =
      typeof (err as any)?.detail === "string" && (err as any).detail.trim()
        ? String((err as any).detail)
        : undefined;

    return { status: 500, body: details ? { message, details } : { message } };
  }

  return { status: 500, body: { message: "Internal server error" } };
}
