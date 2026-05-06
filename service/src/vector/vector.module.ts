import { Module } from '@nestjs/common';
import { VectorService } from './vector.service';

/**
 * 向量库模块
 */
@Module({
  providers: [VectorService],
  exports: [VectorService],
})
export class VectorModule {}
