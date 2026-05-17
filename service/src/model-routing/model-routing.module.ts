import { Module } from '@nestjs/common';
import { ModelRoutingService } from "./model-routing.service";
import { ModelRoutingController } from "./model-routing.controller";
import { ModelModule } from '../model/model.module';
import { IntentModule } from '../intent/intent.module';

/**
 * 模型路由调度模块
 */
@Module({
  imports: [ModelModule, IntentModule],
  controllers: [ModelRoutingController],
  providers: [ModelRoutingService],
  exports: [ModelRoutingService],
})
export class ModelRoutingModule {}
