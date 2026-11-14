import { Controller, Get } from "@nestjs/common";
import { JsonWebKeySet, KeysService } from "./keys.service";

@Controller("lti")
export class LtiController {
  constructor(private readonly keysService: KeysService) {}

  @Get("jwks")
  getJwks(): JsonWebKeySet {
    return this.keysService.getPublicJwks();
  }
}
