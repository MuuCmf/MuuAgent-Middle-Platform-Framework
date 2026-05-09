import { Module } from '@nestjs/common';
import { SkillService } from './skill.service';
import { SkillController } from './skill.controller';
import { McpClientService } from './mcp-client.service';
import { PromptTemplateModule } from '../prompt-template/prompt-template.module';
import { AiSdkModule } from '../ai/providers/ai-sdk.module';
import { ModelModule } from '../model/model.module';

/**
 * 技能模块
 */
@Module({
  imports: [PromptTemplateModule, AiSdkModule, ModelModule],
  controllers: [SkillController],
  providers: [SkillService, McpClientService],
  exports: [SkillService, McpClientService],
})
export class SkillModule {}
