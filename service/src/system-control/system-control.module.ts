import { Module, OnModuleInit } from '@nestjs/common';
import { SystemControlHandler } from './system-control.handler';
import { SystemControlResultController } from './system-control-result.controller';
import { ClientToolRegistry } from '../client-tool';
import { SYSTEM_CONTROL_TOOLS, SYSTEM_CONTROL_TOOL_NAMES } from './system-control.definitions';

@Module({
  controllers: [SystemControlResultController],
  providers: [SystemControlHandler],
  exports: [SystemControlHandler],
})
export class SystemControlModule implements OnModuleInit {
  constructor(
    private readonly clientToolRegistry: ClientToolRegistry,
    private readonly systemControlHandler: SystemControlHandler,
  ) {}

  onModuleInit() {
    this.clientToolRegistry.register({
      /** 注册名称 */
      name: 'system_control',
      /** 该类型下的所有工具名称集合 */
      toolNames: SYSTEM_CONTROL_TOOL_NAMES,
      /** 工具定义列表（注入到 Agent 的工具列表） */
      toolDefinitions: SYSTEM_CONTROL_TOOLS,
      /** 判断是否为该 Agent 启用系统控制工具 */
      isEnabled: (agent) => {
        return agent._systemControlEnabled === true;
      },
      /** SSE 事件前缀，客户端通过 [CLIENT_TOOL:system_control] 识别 */
      eventPrefix: 'SYSTEM_CONTROL',
      /** 客户端执行调度器 */
      handler: this.systemControlHandler,
    });
  }
}
