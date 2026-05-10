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

  // 配置静态文件服务（/admin 路径映射到 public 目录）
  app.useStaticAssets(join(__dirname, '..', '..', 'public'), {
    prefix: '/admin/',
  });

  // 启用CORS跨域
  app.enableCors();

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // SPA 路由支持：/admin 路径返回管理前端
  app.use((req: Request, res: Response, next: NextFunction) => {
    // 如果是 API 路由或静态文件，继续正常处理
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/api-docs') ||
      req.path.match(/\.\w+$/) // 包含文件扩展名的请求
    ) {
      return next();
    }

    // SSE 流式接口需要特殊处理，不经过 SPA 路由
    if (req.headers.accept === 'text/event-stream') {
      return next();
    }

    // /admin 路径返回管理前端 index.html
    if (req.path.startsWith('/admin')) {
      const indexPath = join(__dirname, '..', '..', 'public', 'index.html');
      const fs = require('fs');
      if (!fs.existsSync(indexPath)) {
        return res.status(404).json({
          statusCode: 404,
          message: 'Admin page not found',
          error: 'Not Found'
        });
      }
      return res.sendFile(indexPath);
    }

    // 根路径返回欢迎信息
    if (req.path === '/') {
      return res.json({
        name: 'MuuAI-Middle-Platform',
        description: 'AI模型管理 + MCP调度网关 + Skill + Agent 智能中台',
        version: '1.0.0',
        endpoints: {
          admin: '/admin',
          api: '/api',
          docs: '/api-docs'
        }
      });
    }

    // 其他路由返回 404
    return res.status(404).json({
      statusCode: 404,
      message: 'Resource not found',
      error: 'Not Found'
    });
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
