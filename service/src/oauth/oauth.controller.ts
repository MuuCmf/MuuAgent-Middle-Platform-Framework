import { Controller, Post, Get, Body, Query, Res, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { OAuthService } from './oauth.service';
import { AdminGuard } from '../common/guards/admin.guard';
import { Response, Request } from 'express';

/**
 * OAuth认证控制器
 */
@ApiTags('OAuth认证')
@Controller('oauth')
export class OAuthController {
  /**
   * 构造函数
   * @param oauthService OAuth服务
   */
  constructor(private oauthService: OAuthService) {}

  /**
   * 授权端点
   * @param clientId 客户端ID
   * @param redirectUri 回调地址
   * @param responseType 响应类型
   * @param scope 权限范围
   * @param state 状态参数
   * @param res 响应对象
   */
  @Get('authorize')
  @ApiOperation({ summary: '授权页面', description: '用户登录并授权第三方应用' })
  async authorize(
    @Query('client_id') clientId: string,
    @Query('redirect_uri') redirectUri: string,
    @Query('response_type') responseType: string,
    @Query('scope') scope: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const client = await this.oauthService.validateClient(clientId, undefined, redirectUri);

    res.json({
      client_name: client.name,
      scope,
      state,
      redirect_uri: redirectUri,
    });
  }

  /**
   * 用户确认授权
   * @param req 请求对象
   * @param body 请求体
   * @returns {Promise<any>} 授权码
   */
  @Post('authorize/confirm')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '确认授权', description: '用户确认授权后生成授权码' })
  async confirmAuthorize(
    @Req() req: Request,
    @Body() body: { clientId: string; redirectUri: string; scope: string; state?: string },
  ) {
    const admin = req.admin as any;
    const code = await this.oauthService.generateAuthorizationCode(
      body.clientId,
      admin.id,
      body.redirectUri,
      body.scope,
      body.state,
    );

    return { code, state: body.state };
  }

  /**
   * 令牌端点
   * @param body 请求体
   * @returns {Promise<any>} 令牌信息
   */
  @Post('token')
  @ApiOperation({ summary: '获取令牌', description: '用授权码换取访问令牌' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async token(
    @Body() body: {
      grant_type: string;
      code?: string;
      client_id: string;
      client_secret: string;
      redirect_uri: string;
      refresh_token?: string;
    },
  ) {
    if (body.grant_type === 'authorization_code') {
      return this.oauthService.exchangeCodeForToken(
        body.code!,
        body.client_id,
        body.client_secret,
        body.redirect_uri,
      );
    } else if (body.grant_type === 'refresh_token') {
      return this.oauthService.refreshAccessToken(
        body.refresh_token!,
        body.client_id,
        body.client_secret,
      );
    }

    throw new Error('不支持的授权类型');
  }

  /**
   * 撤销令牌
   * @param body 请求体
   * @returns {Promise<void>}
   */
  @Post('revoke')
  @ApiOperation({ summary: '撤销令牌', description: '撤销访问令牌或刷新令牌' })
  async revoke(@Body() body: { token: string }) {
    await this.oauthService.revokeToken(body.token);
    return { message: '令牌已撤销' };
  }
}
