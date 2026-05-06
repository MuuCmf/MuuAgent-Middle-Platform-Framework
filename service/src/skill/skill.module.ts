import { Module } from '@nestjs/common';
import { SkillService } from './skill.service';
import { SkillController } from './skill.controller';
import { McpClientService } from './mcp-client.service';

/**
 * 技能模块
 */
@Module({
  controllers: [SkillController],
  providers: [SkillService, McpClientService],
  exports: [SkillService, McpClientService],
})
export class SkillModule {}
