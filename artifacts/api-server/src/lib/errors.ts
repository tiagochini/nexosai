export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(401, message, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(403, message, "FORBIDDEN");
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(404, `${resource} not found`, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message, "CONFLICT");
  }
}

export class InsufficientCreditsError extends AppError {
  constructor(
    required: number,
    available: number,
    extra?: { phaseCost?: number; buffer?: number; shortage?: number; campaignType?: string; estimatedTotal?: number },
  ) {
    const shortage = required - available;
    super(
      402,
      `Créditos insuficientes. Saldo: ${available} cr. Necessário: ${required} cr. Compre mais ${shortage} crédito${shortage !== 1 ? "s" : ""} para continuar.`,
      "INSUFFICIENT_CREDITS",
      { balance: available, required, shortage, ...extra },
    );
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message, "VALIDATION_ERROR");
  }
}
