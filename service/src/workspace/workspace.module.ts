import { Module } from '@nestjs/common';
import { WorkspaceToolHandler } from './workspace-tool.handler';
import { WorkspaceResultController } from './workspace-result.controller';

@Module({
  controllers: [WorkspaceResultController],
  providers: [WorkspaceToolHandler],
  exports: [WorkspaceToolHandler],
})
export class WorkspaceModule {}
