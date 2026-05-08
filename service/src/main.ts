import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { Request, Response, NextFunction } from 'express';

/**
 * 应用启动入口函数
 * @returns {Promise<void>}
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 设置全局前缀
  app.setGlobalPrefix('api');

  // 配置静态文件服务
  app.useStaticAssets(join(__dirname, '..', 'public'));

  // 启用CORS跨域
  app.enableCors();

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // SPA 路由支持：所有非 API 路由返回 index.html
  app.use((req: Request, res: Response, next: NextFunction) => {
    // 如果是 API 路由或静态文件，继续正常处理
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/admin') ||
      req.path.startsWith('/api-docs') ||
      req.path.match(/\.\w+$/) // 包含文件扩展名的请求
    ) {
      return next();
    }

    // SSE 流式接口需要特殊处理，不经过 SPA 路由
    if (req.headers.accept === 'text/event-stream') {
      return next();
    }

    // 其他所有路由返回 index.html，让前端路由处理
    res.sendFile(join(__dirname, '..', 'public', 'index.html'));
  });

  // 配置Swagger API文档
  const config = new DocumentBuilder()
    .setTitle('MuuAI-Middle-Platform')
    .setDescription('AI模型管理 + MCP调度网关 + Skill + Agent 智能中台')
    .setVersion('1.0.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'api-key')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`🚀 MuuAI-Middle-Platform 运行在: http://localhost:${port}`);
  console.log(`📚 API文档地址: http://localhost:${port}/api-docs`);
}

bootstrap();
