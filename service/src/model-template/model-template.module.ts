import { Module } from '@nestjs/common';
import { ModelTemplateController } from './model-template.controller';
import { ModelTemplateService } from './model-template.service';
import { PrismaModule } from '../common/prisma/prisma.module';

/**
 * 模型参数模板模块
 */
@Module({
  imports: [PrismaModule],
  controllers: [ModelTemplateController],
  providers: [ModelTemplateService],
  exports: [ModelTemplateService],
})
export class ModelTemplateModule {}
