import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Module, Controller, Get, ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { CoreApiModule } from "./core-api.module";
import { LtiModule } from "./lti/lti.module";

@Controller("health")
class HealthController {
  @Get()
  check() {
    return { status: "ok", version: "v1" };
  }
}

@Module({
  imports: [CoreApiModule, LtiModule],
  controllers: [HealthController],
})
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api/v1");
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  const config = new DocumentBuilder()
    .setTitle("Digital Bridge Accessible Onboarding & Career Gateway API")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, config));

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
