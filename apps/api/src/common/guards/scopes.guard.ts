import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";

@Injectable()
export class ScopesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    const required = Reflect.getMetadata("requiredScopes", context.getHandler()) as string[] | undefined;
    if (!required?.length) return true;
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token) return false;
    const scopes = new Set(token.split(/\s+/));
    return required.every((scope) => scopes.has(scope));
  }
}
