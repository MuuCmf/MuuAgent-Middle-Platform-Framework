import { Module } from '@nestjs/common';
import { ModelService } from './model.service';
import { ModelController, ModelAdminController } from './model.controller';

/**
 * 模型管理模块
 */
@Module({
  controllers: [ModelController, ModelAdminController],
  providers: [ModelService],
  exports: [ModelService],
})
export class ModelModule {}
