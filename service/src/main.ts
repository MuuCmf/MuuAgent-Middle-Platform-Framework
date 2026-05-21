import { NestFactory } from "@nestjs/core";
import { ValidationPipe, ConsoleLogger } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { NestExpressApplication } from "@nestjs/platform-express";
import { join } from "path";
import { AppModule } from "./app.module";
import { Request, Response, NextFunction } from "express";
import { GlobalExceptionFilter } from "./common/errors";
import { VersionService } from "./common/services/version.service";
import { readFileSync } from "fs";

/**
 * 自定义 Logger 类
 * 过滤路由映射日志，保留其他重要日志
 */
class CustomLogger extends ConsoleLogger {
  /**
   * 重写 log 方法，过滤路由映射日志
   * @param message 日志消息
   * @param context 日志上下文
   */
  log(message: any, context?: string) {
    // 过滤路由映射日志
    if (context === 'RouterExplorer' && message.includes('Mapped')) {
      return;
    }
    super.log(message, context);
  }
}

/**
 * 读取版本号
 * @returns {string} 版本号
 */
function getVersion(): string {
  try {
    // 从项目根目录查找 VERSION 文件
    let currentDir = __dirname;
    let versionPath: string | null = null;
    
    // 向上查找，最多查找 10 层
    for (let i = 0; i < 10; i++) {
      const testPath = join(currentDir, 'VERSION');
      try {
        const stats = require('fs').statSync(testPath);
        if (stats.isFile()) {
          versionPath = testPath;
          break;
        }
      } catch {
        // 文件不存在，继续向上查找
      }
      
      const parentDir = join(currentDir, '..');
      if (parentDir === currentDir) {
        // 已经到达根目录
        break;
      }
      currentDir = parentDir;
    }
    
    if (versionPath) {
      return readFileSync(versionPath, 'utf-8').trim();
    } else {
      console.warn('未找到 VERSION 文件，使用默认版本号');
      return '0.0.0';
    }
  } catch (error) {
    console.error('读取版本号失败:', error);
    return '0.0.0';
  }
}

/**
 * 应用启动入口函数
 * @returns {Promise<void>}
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new CustomLogger(),
  });

  const version = getVersion();

  // 设置全局前缀
  app.setGlobalPrefix("api");

  // 配置静态文件服务（ public 目录）
  app.useStaticAssets(join(__dirname, "..", "public", "client"), {
    prefix: "/client",
  });
  app.useStaticAssets(join(__dirname, "..", "public", "admin"), {
    prefix: "/admin",
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

  // 全局异常过滤器
  app.useGlobalFilters(new GlobalExceptionFilter());

  // SPA 路由支持
  app.use((req: Request, res: Response, next: NextFunction) => {
    // 如果是 API 路由或静态文件，继续正常处理
    if (
      req.path.startsWith("/api") ||
      req.path.startsWith("/api-docs") ||
      req.path.match(/\.\w+$/) // 包含文件扩展名的请求
    ) {
      return next();
    }

    // SSE 流式接口需要特殊处理，不经过 SPA 路由
    if (req.headers.accept === "text/event-stream") {
      return next();
    }

    // 根路径返回欢迎信息
    if (req.path === "/") {
      return res.json({
        name: "MuuAgent",
        description:
          "AI模型管理 + 智能调度 + Skill + Agent + RAG知识库 智能中台",
        version: version,
        endpoints: {
          api: "/api",
          docs: "/api-docs",
        },
      });
    }

    // SPA 路由回退：/client 和 /admin 路径下的所有路由返回对应的 index.html
    if (req.path.startsWith("/client")) {
      return res.sendFile(join(__dirname, "..", "public", "client", "index.html"));
    }
    if (req.path.startsWith("/admin")) {
      return res.sendFile(join(__dirname, "..", "public", "admin", "index.html"));
    }

    // 其他路由返回 404
    return res.status(404).json({
      statusCode: 404,
      message: "Resource not found",
      error: "Not Found",
    });
  });

  // 配置Swagger API文档
  const config = new DocumentBuilder()
    .setTitle("MuuAgent")
    .setDescription("AI模型管理 + 智能调度 + Skill + Agent 智能中台")
    .setVersion(version)
    .addBearerAuth()
    .addApiKey({ type: "apiKey", name: "x-api-key", in: "header" }, "api-key")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api-docs", app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`🚀 MuuAgent v${version} 运行在: http://localhost:${port}`);
  console.log(`📚 API文档地址: http://localhost:${port}/api-docs`);
}

bootstrap();
