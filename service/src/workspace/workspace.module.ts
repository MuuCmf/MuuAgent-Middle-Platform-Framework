import { Module, OnModuleInit } from '@nestjs/common';
import { WorkspaceToolHandler } from './workspace-tool.handler';
import { WorkspaceResultController } from './workspace-result.controller';
import { ClientToolRegistry } from '../client-tool';
import { WORKSPACE_TOOLS } from './workspace-tool.definitions';

@Module({
  controllers: [WorkspaceResultController],
  providers: [WorkspaceToolHandler],
  exports: [WorkspaceToolHandler],
})
export class WorkspaceModule implements OnModuleInit {
  constructor(
    private readonly clientToolRegistry: ClientToolRegistry,
    private readonly workspaceToolHandler: WorkspaceToolHandler,
  ) {}

  onModuleInit() {
    this.clientToolRegistry.register({
      name: 'workspace',
      toolNames: new Set(WORKSPACE_TOOLS.map(t => t.name)),
      toolDefinitions: WORKSPACE_TOOLS,
      isEnabled: (agent) => {
        if (!agent.workspaceConfig) return false;
        const config = typeof agent.workspaceConfig === 'string'
          ? JSON.parse(agent.workspaceConfig)
          : agent.workspaceConfig;
        return !!config.enabled;
      },
      eventPrefix: 'WORKSPACE_TOOL',
      handler: this.workspaceToolHandler,
    });
  }
}
