import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
  );

  /*
   * --------------------------------------------------
   * CORS
   * --------------------------------------------------
   */

  app.enableCors({
    origin: 'http://localhost:3000',
    credentials: true,
  });

  /*
   * --------------------------------------------------
   * Cookie Parser
   * --------------------------------------------------
   */

  app.use(cookieParser());

  /*
   * --------------------------------------------------
   * Static Files
   * --------------------------------------------------
   */

  app.useStaticAssets(
    join(process.cwd(), 'uploads'),
    {
      prefix: '/uploads/',
    },
  );

  /*
   * --------------------------------------------------
   * Start Server
   * --------------------------------------------------
   */

  await app.listen(
    process.env.PORT ?? 7000,
  );
}

bootstrap();