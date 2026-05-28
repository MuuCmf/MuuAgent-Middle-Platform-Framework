import { Module } from '@nestjs/common';
import { VoiceProfileController } from './voice-profile.controller';
import { VoiceProfileClientController } from './voice-profile.client.controller';
import { VoiceProfileService } from './voice-profile.service';
import { PrismaModule } from '../common/prisma/prisma.module';

/**
 * 语音配置管理模块
 */
@Module({
  imports: [PrismaModule],
  controllers: [VoiceProfileController, VoiceProfileClientController],
  providers: [VoiceProfileService],
  exports: [VoiceProfileService],
})
export class VoiceProfileModule {}
