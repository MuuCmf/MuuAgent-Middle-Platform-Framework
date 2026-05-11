import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AdminGuard } from '../common/guards/admin.guard';
import { CombinedAuthGuard } from '../common/guards/combined-auth.guard';
import { ScopeGuard } from '../common/guards/scope.guard';

/**
 * 认证模块（全局模块）
 * 提供JWT认证守卫、组合认证守卫和Scope校验守卫给所有模块使用
 */
@Global()
@Module({
  imports: [
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
  providers: [AdminGuard, CombinedAuthGuard, ScopeGuard],
  exports: [JwtModule, AdminGuard, CombinedAuthGuard, ScopeGuard],
})
export class AuthModule {}
