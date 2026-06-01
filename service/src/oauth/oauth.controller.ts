import { Controller, Post, Get, Put, Delete, Body, Query, Param, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { OAuthService } from './oauth.service';
import { CombinedAuthGuard } from '../common/guards/combined-auth.guard';
import { ScopeGuard } from '../common/guards/scope.guard';
import { RequireScope } from '../common/decorators/scope.decorator';
import { AdminScope } from '../common/constants/scope.constants';
import { success } from '../common/response/api.response';

/**
 * OAuth认证控制器
 */
@ApiTags('OAuth（业务端）')
@Controller('oauth')
export class OAuthController {
  /**
   * 构造函数
   * @param oauthService OAuth服务
   */
  constructor(private oauthService: OAuthService) {}

  /**
   * 令牌端点
   * @param body 请求体
   * @returns {Promise<any>} 令牌信息
   */
  @Post('token')
  @ApiOperation({ summary: '获取令牌', description: '支持客户端凭证和刷新令牌两种模式' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async token(
    @Body() body: {
      grant_type: string;
      client_id: string;
      client_secret: string;
      refresh_token?: string;
    },
  ) {
    if (body.grant_type === 'client_credentials') {
      return this.oauthService.generateClientCredentialsToken(
        body.client_id,
        body.client_secret,
      );
    } else if (body.grant_type === 'refresh_token') {
      return this.oauthService.refreshAccessToken(
        body.refresh_token!,
        body.client_id,
        body.client_secret,
      );
    }

    throw new BadRequestException('不支持的授权类型');
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
@ApiTags('OAuth（管理端）')
@Controller('admin/oauth')
@UseGuards(CombinedAuthGuard, ScopeGuard)
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
   * @param appCode 应用标识
   * @returns {Promise<any>} 客户端列表
   */
  @Get('clients')
  @ApiOperation({ summary: '获取客户端列表' })
  @RequireScope(AdminScope.APP_READ)
  async getClients(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('search') search?: string,
    @Query('appCode') appCode?: string,
  ) {
    const data = await this.oauthService.getClients(page, pageSize, search, appCode);
    return success(data);
  }

  /**
   * 获取客户端详情
   * @param id 客户端ID
   * @returns {Promise<any>} 客户端详情
   */
  @Get('clients/:id')
  @ApiOperation({ summary: '获取客户端详情' })
  @RequireScope(AdminScope.APP_READ)
  async getClient(@Param('id') id: string) {
    const data = await this.oauthService.getClientById(id);
    return success(data);
  }

  /**
   * 创建客户端
   * @param body 请求体
   * @returns {Promise<any>} 创建的客户端
   */
  @Post('clients')
  @ApiOperation({ summary: '创建客户端' })
  @RequireScope(AdminScope.APP_WRITE)
  async createClient(
    @Body()
    body: {
      name: string;
      redirectUris: string[];
      scopes: string[];
      grants?: string[];
      appCode?: string;
    },
  ) {
    const data = await this.oauthService.createClient(body);
    return success(data, '客户端创建成功');
  }

  /**
   * 更新客户端
   * @param id 客户端ID
   * @param body 请求体
   * @returns {Promise<any>} 更新后的客户端
   */
  @Put('clients/:id')
  @ApiOperation({ summary: '更新客户端' })
  @RequireScope(AdminScope.APP_WRITE)
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
    const data = await this.oauthService.updateClient(id, body);
    return success(data, '客户端更新成功');
  }

  /**
   * 删除客户端
   * @param id 客户端ID
   * @returns {Promise<void>}
   */
  @Delete('clients/:id')
  @ApiOperation({ summary: '删除客户端' })
  @RequireScope(AdminScope.APP_WRITE)
  async deleteClient(@Param('id') id: string) {
    await this.oauthService.deleteClient(id);
    return success(null, '客户端已删除');
  }

  /**
   * 重置客户端密钥
   * @param id 客户端ID
   * @returns {Promise<any>} 新的客户端密钥
   */
  @Post('clients/:id/reset-secret')
  @ApiOperation({ summary: '重置客户端密钥' })
  @RequireScope(AdminScope.APP_WRITE)
  async resetSecret(@Param('id') id: string) {
    const data = await this.oauthService.resetClientSecret(id);
    return success(data, '密钥重置成功');
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
  @RequireScope(AdminScope.APP_READ)
  async getTokens(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('clientId') clientId?: string,
  ) {
    const data = await this.oauthService.getTokens(page, pageSize, clientId);
    return success(data);
  }

  /**
   * 撤销令牌
   * @param id 令牌ID
   * @returns {Promise<void>}
   */
  @Post('tokens/:id/revoke')
  @ApiOperation({ summary: '撤销令牌' })
  @RequireScope(AdminScope.APP_WRITE)
  async revokeToken(@Param('id') id: string) {
    await this.oauthService.revokeTokenById(id);
    return success(null, '令牌已撤销');
  }
}
