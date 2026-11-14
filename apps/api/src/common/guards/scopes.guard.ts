import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { jwtVerify } from "jose";
import { Request } from "express";
import { REQUIRED_SCOPES } from "../decorators/require-scopes.decorator";
import { throwBilingualHttp } from "../filters/bilingual-exception.filter";

const secret = () => new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-bridge-oauth-secret-2026",
);

@Injectable()
export class ScopesGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.requiredScopes(context);
    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.header("authorization");
    const enforced = request.header("x-enforce-scopes")?.toLowerCase() === "true";

    if (!authorization && !enforced) return true;
    if (!authorization?.match(/^Bearer\s+\S+$/i)) {
      throwBilingualHttp(401, undefined, "Unauthorized");
    }

    let payload: { scope?: string; scopes?: string[] };
    try {
      const verified = await jwtVerify(authorization!.replace(/^Bearer\s+/i, ""), secret(), {
        algorithms: ["HS256"],
      });
      payload = verified.payload as typeof payload;
    } catch {
      throwBilingualHttp(401, undefined, "Unauthorized");
    }

    if (!required.length) return true;
    const granted = new Set([
      ...(typeof payload.scope === "string" ? payload.scope.split(/\s+/) : []),
      ...(Array.isArray(payload.scopes) ? payload.scopes : []),
    ]);
    if (!required.every((scope) => granted.has(scope))) {
      throwBilingualHttp(403, undefined, "Forbidden");
    }
    return true;
  }

  private requiredScopes(context: ExecutionContext): string[] {
    return [
      ...(Reflect.getMetadata(REQUIRED_SCOPES, context.getClass()) || []),
      ...(Reflect.getMetadata(REQUIRED_SCOPES, context.getHandler()) || []),
    ];
  }
}
