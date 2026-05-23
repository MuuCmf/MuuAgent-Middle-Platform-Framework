import { Module } from '@nestjs/common';
import { DynamicClientToolHandler } from './dynamic-client-tool.handler';
import { DynamicClientToolService } from './dynamic-client-tool.service';
import { DynamicClientToolController } from './dynamic-client-tool.controller';
import { CommonModule } from '../../common/common.module';

/**
 * 动态客户端工具模块
 *
 * 提供用户自扩展客户端工具的能力：
 * - DynamicClientToolHandler: 通用 SSE 下发处理器
 * - DynamicClientToolService: CRUD 管理服务
 * - DynamicClientToolController: REST API
 *
 * 用户通过 API 注册工具后，Handler 自动刷新缓存，
 * 无需重启服务即可生效
 */
@Module({
  imports: [CommonModule],
  providers: [DynamicClientToolHandler, DynamicClientToolService],
  controllers: [DynamicClientToolController],
  exports: [DynamicClientToolService],
})
export class DynamicClientToolModule {}
