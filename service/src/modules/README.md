# 即插即用模块目录

在此目录下创建模块目录，应用重启后自动发现并加载，无需修改 `app.module.ts` 或 `module-registry.ts`。

## 快速开始

### 1. 创建模块目录和文件

```
src/modules/hello/
  hello.module.ts
  hello.controller.ts
  hello.service.ts
```

### 2. 编写 Module

```typescript
// hello.module.ts
import { Module } from '@nestjs/common';
import { HelloController } from './hello.controller';
import { HelloService } from './hello.service';

@Module({
  controllers: [HelloController],
  providers: [HelloService],
})
export class HelloModule {}
```

### 3. 编写 Controller

```typescript
// hello.controller.ts
import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HelloService } from './hello.service';

@ApiTags('Hello')
@Controller('hello')
export class HelloController {
  constructor(private readonly service: HelloService) {}

  @Get()
  index() {
    return this.service.getMessage();
  }
}
```

### 4. 编写 Service

```typescript
// hello.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class HelloService {
  getMessage() {
    return { message: 'Hello from plug-and-play module!' };
  }
}
```

## 约定

- 目录名 = 模块名（会作为模块 ID 用于去重）
- 模块入口文件名为 `<目录名>.module.ts`
- 模块只能存在一个 `@Module()` 装饰的类（取第一个匹配的 export）
- 所有 provider（Service、Guard 等）通过 NestJS DI 自动注入

## 依赖其他模块

自动发现系统会读取 `@Module({ imports: [...] })` 的元数据来解析依赖。如果依赖的模块也在自动发现范围内，会通过拓扑排序确保加载顺序正确。

```typescript
@Module({
  imports: [PrismaModule],  // 全局模块，始终可用
  controllers: [MyController],
  providers: [MyService],
})
export class MyModule {}
```

## 环境变量控制

通过 `ENABLED_MODULES` 环境变量可以控制模块的加载：

```bash
ENABLED_MODULES=all              # 加载全部（默认）
ENABLED_MODULES=hello,agent      # 仅加载指定模块及其传递依赖
ENABLED_MODULES=all,-log         # 排除特定模块
```

## 注意事项

- `src/modules/` 下的模块**仅在 `nest build` 编译过文件后，重启应用才会被扫描到**
- 模块名不能与已有业务模块重名（如 `agent`、`skill`、`model` 等）
- 全局模块（`@Global()` 装饰的模块）需要由其他模块显式 import 或者放在 `app.module.ts` 中
