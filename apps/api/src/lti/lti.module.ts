import { Module } from "@nestjs/common";
import { KeysService } from "./keys.service";
import { LtiController } from "./lti.controller";
import { LOGIN_STATE_STORE_CLOCK, LoginStateStore } from "./login-state.store";
import { NONCE_STORE_CLOCK, NonceStore } from "./nonce.store";
import { LTI_PLATFORMS_CONFIG, PlatformRegistry } from "./platform.registry";

@Module({
  controllers: [LtiController],
  providers: [
    KeysService,
    PlatformRegistry,
    NonceStore,
    LoginStateStore,
    { provide: NONCE_STORE_CLOCK, useValue: Date.now },
    { provide: LOGIN_STATE_STORE_CLOCK, useValue: Date.now },
    {
      provide: LTI_PLATFORMS_CONFIG,
      useFactory: () => process.env.LTI_PLATFORMS_JSON,
    },
  ],
})
export class LtiModule {}
