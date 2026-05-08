import { Module } from '@nestjs/common';
import { OAuthService } from './oauth.service';
import { OAuthController, OAuthAdminController } from './oauth.controller';
import { PrismaModule } from '../common/prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

/**
 * OAuth模块
 */
@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '2h',
        } as any,
      }),
    }),
  ],
  controllers: [OAuthController, OAuthAdminController],
  providers: [OAuthService],
  exports: [OAuthService],
})
export class OAuthModule {}
