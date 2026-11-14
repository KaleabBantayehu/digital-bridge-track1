import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Response } from "express";
import {
  BilingualApiError,
  ERROR_MESSAGES,
  ErrorCode,
  Localized,
} from "@db/shared-schemas";

const SUMMARY: Record<string, Localized> = {
  ValidationError: {
    en: "Please check the highlighted fields and try again.",
    am: "እባክዎ የተመለከቱትን ቦታዎች ይመልከቱና እንደገና ይሞክሩ።",
  },
  NotFound: {
    en: "We could not find the requested resource.",
    am: "የተጠየቀው መረጃ አልተገኘም።",
  },
  Gone: {
    en: "This resource is no longer available.",
    am: "ይህ መረጃ ከአሁን በኋላ አይገኝም።",
  },
  Unauthorized: {
    en: "You are not authorised to perform this action.",
    am: "ይህን ተግባር ለማከናወን ፈቃድ የለዎትም።",
  },
  Forbidden: {
    en: "You do not have permission to perform this action.",
    am: "ይህን ተግባር ለማከናወን ፈቃድ የለዎትም።",
  },
  InternalError: {
    en: "Something went wrong. Please try again.",
    am: "ችግር ተፈጥሯል። እባክዎ እንደገና ይሞክሩ።",
  },
  RateLimited: {
    en: "Too many requests. Please wait a moment and try again.",
    am: "ብዙ ጥያቄዎች ተልከዋል። እባክዎ ትንሽ ቆይተው ይሞክሩ።",
  },
};

function errorName(status: number, requested?: string): BilingualApiError["error"] {
  if (requested === "LtiLaunchRejected") return "LtiLaunchRejected";
  if (status === HttpStatus.UNAUTHORIZED) return "Unauthorized";
  if (status === HttpStatus.FORBIDDEN) return "Forbidden";
  if (status === HttpStatus.NOT_FOUND) return "NotFound";
  if (status === HttpStatus.GONE) return "NotFound";
  if (status === HttpStatus.CONFLICT) return "Conflict";
  if (status === HttpStatus.TOO_MANY_REQUESTS) return "RateLimited";
  if (status === HttpStatus.UNPROCESSABLE_ENTITY || status === HttpStatus.BAD_REQUEST) {
    return "ValidationError";
  }
  return "InternalError";
}

function codeFor(value: unknown): ErrorCode {
  return value === "INVALID_ET_PHONE" ||
    value === "INVALID_EMAIL" ||
    value === "INVALID_ET_DATE" ||
    value === "CONSENT_REQUIRED" ||
    value === "TOKEN_EXPIRED" ||
    value === "TOKEN_USED" ||
    value === "LTI_BAD_SIGNATURE" ||
    value === "LTI_BAD_NONCE" ||
    value === "LTI_BAD_AUDIENCE" ||
    value === "LTI_EXPIRED" ||
    value === "RATE_LIMITED"
    ? value
    : "REQUIRED";
}

function field(field: string, code: ErrorCode) {
  return { field, code, message: ERROR_MESSAGES[code] };
}

@Catch()
export class BilingualExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let raw: Record<string, any> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      raw = typeof body === "string" ? { message: body } : body as Record<string, any>;
    }

    if (raw.statusCode && raw.summary && Array.isArray(raw.fields)) {
      return response.status(status).json(raw);
    }

    const fields = Array.isArray(raw.fields)
      ? raw.fields.map((item: any) => field(String(item.field || "form"), codeFor(item.code)))
      : Array.isArray(raw.fieldErrors)
        ? raw.fieldErrors.map((item: any) => field(String(item.field || "form"), codeFor(item.code)))
        : [];

    if (status === HttpStatus.TOO_MANY_REQUESTS && fields.length === 0) {
      fields.push(field("form", "RATE_LIMITED"));
    }

    if (Array.isArray(raw.message)) {
      for (const message of raw.message) {
        const [name, code] = String(message).split(":");
        fields.push(field(name?.trim() || "form", codeFor(code?.trim())));
      }
      status = HttpStatus.UNPROCESSABLE_ENTITY;
    }

    const kind = errorName(status, raw.error);
    const summary = SUMMARY[kind] || SUMMARY.InternalError;
    const body: BilingualApiError = {
      statusCode: status,
      error: kind,
      summary: raw.summary || summary,
      fields,
    };
    return response.status(status).json(body);
  }
}

export function throwFieldValidation(fieldName: string, code: ErrorCode): never {
  throw new HttpException(
    {
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      error: "ValidationError",
      summary: SUMMARY.ValidationError,
      fields: [field(fieldName, code)],
    },
    HttpStatus.UNPROCESSABLE_ENTITY,
  );
}

export function throwBilingualHttp(
  status: number,
  code: ErrorCode | undefined = undefined,
  error?: BilingualApiError["error"],
): never {
  const fields = code ? [field("form", code)] : [];
  const kind = error || errorName(status);
  throw new HttpException(
    {
      statusCode: status,
      error: kind,
      summary: SUMMARY[kind] || SUMMARY.InternalError,
      fields,
    },
    status,
  );
}
