import { Controller, Post, Get, Put, Delete, Body, Query, Param, Res, UseGuards, Req } from '@nestjs/common';
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

/**
 * OAuth管理端控制器
 */
@ApiTags('OAuth管理')
@Controller('admin/oauth')
@UseGuards(AdminGuard)
@ApiBearerAuth()
export class OAuthAdminController {
  /**
   * 构造函数
   * @param oauthService OAuth服务
   */
  constructor(private oauthService: OAuthService) {}

  /**
   * 获取客户端列表
   * @param page 页码
   * @param pageSize 每页数量
   * @param search 搜索关键词
   * @returns {Promise<any>} 客户端列表
   */
  @Get('clients')
  @ApiOperation({ summary: '获取客户端列表' })
  async getClients(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('search') search?: string,
  ) {
    return this.oauthService.getClients(page, pageSize, search);
  }

  /**
   * 获取客户端详情
   * @param id 客户端ID
   * @returns {Promise<any>} 客户端详情
   */
  @Get('clients/:id')
  @ApiOperation({ summary: '获取客户端详情' })
  async getClient(@Param('id') id: string) {
    return this.oauthService.getClientById(id);
  }

  /**
   * 创建客户端
   * @param body 请求体
   * @returns {Promise<any>} 创建的客户端
   */
  @Post('clients')
  @ApiOperation({ summary: '创建客户端' })
  async createClient(
    @Body()
    body: {
      name: string;
      redirectUris: string[];
      scopes: string[];
      grants?: string[];
    },
  ) {
    return this.oauthService.createClient(body);
  }

  /**
   * 更新客户端
   * @param id 客户端ID
   * @param body 请求体
   * @returns {Promise<any>} 更新后的客户端
   */
  @Put('clients/:id')
  @ApiOperation({ summary: '更新客户端' })
  async updateClient(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      redirectUris?: string[];
      scopes?: string[];
      grants?: string[];
      status?: number;
    },
  ) {
    return this.oauthService.updateClient(id, body);
  }

  /**
   * 删除客户端
   * @param id 客户端ID
   * @returns {Promise<void>}
   */
  @Delete('clients/:id')
  @ApiOperation({ summary: '删除客户端' })
  async deleteClient(@Param('id') id: string) {
    await this.oauthService.deleteClient(id);
    return { message: '客户端已删除' };
  }

  /**
   * 重置客户端密钥
   * @param id 客户端ID
   * @returns {Promise<any>} 新的客户端密钥
   */
  @Post('clients/:id/reset-secret')
  @ApiOperation({ summary: '重置客户端密钥' })
  async resetSecret(@Param('id') id: string) {
    return this.oauthService.resetClientSecret(id);
  }

  /**
   * 获取令牌列表
   * @param page 页码
   * @param pageSize 每页数量
   * @param clientId 客户端ID
   * @returns {Promise<any>} 令牌列表
   */
  @Get('tokens')
  @ApiOperation({ summary: '获取令牌列表' })
  async getTokens(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('clientId') clientId?: string,
  ) {
    return this.oauthService.getTokens(page, pageSize, clientId);
  }

  /**
   * 撤销令牌
   * @param id 令牌ID
   * @returns {Promise<void>}
   */
  @Post('tokens/:id/revoke')
  @ApiOperation({ summary: '撤销令牌' })
  async revokeToken(@Param('id') id: string) {
    await this.oauthService.revokeTokenById(id);
    return { message: '令牌已撤销' };
  }
}
