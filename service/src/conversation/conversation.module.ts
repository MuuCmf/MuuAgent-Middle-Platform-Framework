import { Module } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { ConversationController, ConversationAdminController } from './conversation.controller';

/**
 * 会话模块
 */
@Module({
  controllers: [ConversationController, ConversationAdminController],
  providers: [ConversationService],
  exports: [ConversationService],
})
export class ConversationModule {}
