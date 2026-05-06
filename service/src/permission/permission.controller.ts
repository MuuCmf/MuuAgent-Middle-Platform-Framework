import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PermissionService } from './permission.service';
import { GrantPermissionDto } from './dto/grant-permission.dto';
import { RevokePermissionDto } from './dto/revoke-permission.dto';
import { CheckPermissionDto } from './dto/check-permission.dto';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { success } from '../common/response/api.response';

/**
 * 权限管理控制器
 */
@Controller('kb/permission')
@UseGuards(ApiKeyGuard)
export class PermissionController {
  /**
   * 构造函数
   * @param permissionService 权限服务
   */
  constructor(private readonly permissionService: PermissionService) {}

  /**
   * 授予权限
   * @param dto 授权参数
   * @returns {Promise<any>} 授权结果
   */
  @Post('grant')
  async grant(@Body() dto: GrantPermissionDto) {
    const result = await this.permissionService.grantPermission(dto);
    return success(result, '授权成功');
  }

  /**
   * 撤销权限
   * @param dto 撤销参数
   * @returns {Promise<any>} 撤销结果
   */
  @Post('revoke')
  async revoke(@Body() dto: RevokePermissionDto) {
    const result = await this.permissionService.revokePermission(dto);
    return success(result, '撤销权限成功');
  }

  /**
   * 检查权限
   * @param dto 检查参数
   * @returns {Promise<any>} 检查结果
   */
  @Post('check')
  async check(@Body() dto: CheckPermissionDto) {
    const result = await this.permissionService.checkPermission(dto);
    return success({ hasPermission: result }, '检查权限成功');
  }

  /**
   * 获取知识库的所有权限
   * @param kbId 知识库ID
   * @returns {Promise<any>} 权限列表
   */
  @Get('list/:kbId')
  async getKbPermissions(@Param('kbId') kbId: string) {
    const result = await this.permissionService.getKbPermissions(kbId);
    return success(result, '查询成功');
  }

  /**
   * 获取用户的知识库权限
   * @param kbId 知识库ID
   * @param uid 用户ID
   * @returns {Promise<any>} 用户权限
   */
  @Get('user')
  async getUserPermission(
    @Query('kbId') kbId: string,
    @Query('uid') uid: string,
  ) {
    const result = await this.permissionService.getUserPermission(kbId, uid);
    return success(result, '查询成功');
  }
}
