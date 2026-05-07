import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OAuthAdminService } from './oauth-admin.service';
import { AdminGuard } from '../common/guards/admin.guard';

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
   * @param oauthAdminService OAuth管理服务
   */
  constructor(private oauthAdminService: OAuthAdminService) {}

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
    return this.oauthAdminService.getClients(page, pageSize, search);
  }

  /**
   * 获取客户端详情
   * @param id 客户端ID
   * @returns {Promise<any>} 客户端详情
   */
  @Get('clients/:id')
  @ApiOperation({ summary: '获取客户端详情' })
  async getClient(@Param('id') id: string) {
    return this.oauthAdminService.getClientById(id);
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
    return this.oauthAdminService.createClient(body);
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
    return this.oauthAdminService.updateClient(id, body);
  }

  /**
   * 删除客户端
   * @param id 客户端ID
   * @returns {Promise<void>}
   */
  @Delete('clients/:id')
  @ApiOperation({ summary: '删除客户端' })
  async deleteClient(@Param('id') id: string) {
    await this.oauthAdminService.deleteClient(id);
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
    return this.oauthAdminService.resetClientSecret(id);
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
    return this.oauthAdminService.getTokens(page, pageSize, clientId);
  }

  /**
   * 撤销令牌
   * @param id 令牌ID
   * @returns {Promise<void>}
   */
  @Post('tokens/:id/revoke')
  @ApiOperation({ summary: '撤销令牌' })
  async revokeToken(@Param('id') id: string) {
    await this.oauthAdminService.revokeTokenById(id);
    return { message: '令牌已撤销' };
  }
}
