// apps/api/src/main.ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import * as fs from 'fs';
import * as path from 'path';
import { Module, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { CoreApiModule } from './core-api.module';
import { LtiModule } from './lti/lti.module';

@Module({
  imports: [CoreApiModule, LtiModule],
})
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.setGlobalPrefix("api/v1");
  const corsOrigins = (process.env.CORS_ORIGINS ||
    "http://localhost:5173,http://localhost:8080,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:8080")
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: (origin, callback) => {
      let hostedVercel = false;
      try {
        hostedVercel = new URL(origin).hostname.endsWith('.vercel.app');
      } catch {
        hostedVercel = false;
      }
      if (!origin || corsOrigins.includes(origin) || hostedVercel) callback(null, true);
      else callback(new Error('Origin not allowed by CORS'), false);
    },
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  const config = new DocumentBuilder()
    .setTitle("Digital Bridge Accessible Onboarding & Career Gateway API")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("docs", app, document);
  SwaggerModule.setup("api/docs", app, document);
  const docsDir = path.join(process.cwd(), "docs");
  fs.mkdirSync(docsDir, { recursive: true });
  fs.writeFileSync(path.join(docsDir, "openapi.json"), JSON.stringify(document, null, 2), "utf8");

  await app.listen(Number(process.env.PORT) || 3000, "0.0.0.0");
}
bootstrap();
