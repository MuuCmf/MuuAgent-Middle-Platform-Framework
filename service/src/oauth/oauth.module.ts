import { Module } from '@nestjs/common';
import { OAuthService } from './oauth.service';
import { OAuthAdminService } from './oauth-admin.service';
import { OAuthController } from './oauth.controller';
import { OAuthAdminController } from './oauth-admin.controller';
import { PrismaModule } from '../common/prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

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
  providers: [OAuthService, OAuthAdminService],
  exports: [OAuthService, OAuthAdminService],
})
export class OAuthModule {}
