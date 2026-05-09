import { Module, Global } from '@nestjs/common';
import { PromptTemplateService } from './prompt-template.service';
import { PromptTemplateController } from './prompt-template.controller';
import { PrismaModule } from '../common/prisma/prisma.module';

/**
 * Prompt 模板模块
 * 提供模板管理功能，供其他模块使用
 */
@Global()
@Module({
  imports: [PrismaModule],
  controllers: [PromptTemplateController],
  providers: [PromptTemplateService],
  exports: [PromptTemplateService],
})
export class PromptTemplateModule {}
