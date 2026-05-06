import { Module } from '@nestjs/common';
import { LogService } from './log.service';
import { LogController } from './log.controller';

/**
 * 日志模块
 */
@Module({
  controllers: [LogController],
  providers: [LogService],
  exports: [LogService],
})
export class LogModule {}
