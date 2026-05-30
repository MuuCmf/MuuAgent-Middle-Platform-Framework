import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse as SwaggerApiResponse } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { LoginDto } from './dto/login.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { QueryAdminDto } from './dto/query-admin.dto';
import { CombinedAuthGuard } from '../common/guards/combined-auth.guard';
import { ScopeGuard } from '../common/guards/scope.guard';
import { RequireScope } from '../common/decorators/scope.decorator';
import { AdminScope } from '../common/constants/scope.constants';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { Request } from 'express';
import { success, page, ApiResponse } from '../common/response/api.response';

/**
 * 管理员控制器
 */
@ApiTags('管理员')
@Controller('admin')
export class AdminController {
  /**
   * 构造函数
   * @param adminService 管理员服务
   */
  constructor(private readonly adminService: AdminService) {}

  /**
   * 管理员登录
   * @param loginDto 登录DTO
   * @param req 请求对象
   * @returns {Promise<Object>} 登录结果
   */
  @Post('login')
  @ApiOperation({ summary: '管理员登录' })
  @SwaggerApiResponse({ status: 200, description: '登录成功' })
  @SwaggerApiResponse({ status: 401, description: '账号或密码错误' })
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
  ) {
    const clientIp = req.ip || req.connection.remoteAddress || '';
    const result = await this.adminService.login(loginDto, clientIp);
    return success(result, '登录成功');
  }

  /**
   * 刷新访问令牌
   * @param refreshTokenDto 刷新令牌DTO
   * @returns {Promise<Object>} 新的令牌对
   */
  @Post('refresh')
  @ApiOperation({ summary: '刷新访问令牌' })
  @SwaggerApiResponse({ status: 200, description: '刷新成功' })
  @SwaggerApiResponse({ status: 401, description: '刷新令牌无效或已过期' })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    const result = await this.adminService.refreshToken(refreshTokenDto.refreshToken);
    return success(result, '刷新成功');
  }

  /**
   * 管理员登出
   * @param admin 当前管理员
   * @param req 请求对象
   * @returns {Promise<Object>} 登出结果
   */
  @Post('logout')
  @UseGuards(CombinedAuthGuard, ScopeGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理员登出' })
  @SwaggerApiResponse({ status: 200, description: '登出成功' })
  async logout(
    @CurrentAdmin() admin: any,
    @Req() req: Request,
  ) {
    const refreshToken = req.body?.refreshToken;
    await this.adminService.logout(admin.sub, refreshToken);
    return success(null, '登出成功');
  }

  /**
   * 获取当前登录管理员信息
   * @param admin 当前管理员
   * @returns {Promise<Object>} 管理员信息
   */
  @Get('profile')
  @UseGuards(CombinedAuthGuard, ScopeGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前登录管理员信息' })
  @SwaggerApiResponse({ status: 200, description: '获取成功' })
  async getProfile(@CurrentAdmin() admin: any) {
    return success(admin, '获取成功');
  }

  /**
   * 修改密码
   * @param admin 当前管理员
   * @param changePasswordDto 修改密码DTO
   * @returns {Promise<Object>} 修改结果
   */
  @Patch('password')
  @UseGuards(CombinedAuthGuard, ScopeGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '修改密码' })
  @SwaggerApiResponse({ status: 200, description: '修改成功' })
  @SwaggerApiResponse({ status: 400, description: '原密码错误' })
  async changePassword(
    @CurrentAdmin() admin: any,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    await this.adminService.changePassword(admin.sub, changePasswordDto);
    return success(null, '密码修改成功');
  }

  /**
   * 分页查询管理员列表
   * @param query 查询参数
   * @returns {Promise<Object>} 分页结果
   */
  @Get()
  @UseGuards(CombinedAuthGuard, ScopeGuard)
  @ApiBearerAuth()
  @RequireScope(AdminScope.ADMIN_READ)
  @ApiOperation({ summary: '分页查询管理员列表' })
  @SwaggerApiResponse({ status: 200, description: '获取成功' })
  async findPage(@Query() query: QueryAdminDto) {
    const result = await this.adminService.findPage(query);
    return page(result.list, result.total, result.page, result.pageSize);
  }

  /**
   * 创建管理员
   * @param admin 当前管理员
   * @param createAdminDto 创建管理员DTO
   * @returns {Promise<Object>} 创建的管理员信息
   */
  @Post()
  @UseGuards(CombinedAuthGuard, ScopeGuard)
  @ApiBearerAuth()
  @RequireScope(AdminScope.ADMIN_WRITE)
  @ApiOperation({ summary: '创建管理员' })
  @SwaggerApiResponse({ status: 201, description: '创建成功' })
  @SwaggerApiResponse({ status: 409, description: '账号已存在' })
  async create(
    @CurrentAdmin() admin: any,
    @Body() createAdminDto: CreateAdminDto,
  ) {
    const result = await this.adminService.createAdmin(
      admin.sub,
      admin.isSuperAdmin ?? false,
      createAdminDto,
    );
    return success(result, '创建成功');
  }

  /**
   * 更新管理员信息
   * @param admin 当前管理员
   * @param id 管理员ID
   * @param updateAdminDto 更新管理员DTO
   * @returns {Promise<Object>} 更新后的管理员信息
   */
  @Patch(':id')
  @UseGuards(CombinedAuthGuard, ScopeGuard)
  @ApiBearerAuth()
  @RequireScope(AdminScope.ADMIN_WRITE)
  @ApiOperation({ summary: '更新管理员信息' })
  @SwaggerApiResponse({ status: 200, description: '更新成功' })
  @SwaggerApiResponse({ status: 404, description: '管理员不存在' })
  async update(
    @CurrentAdmin() admin: any,
    @Param('id') id: string,
    @Body() updateAdminDto: UpdateAdminDto,
  ) {
    const result = await this.adminService.update(
      admin.sub,
      admin.isSuperAdmin ?? false,
      id,
      updateAdminDto,
    );
    return success(result, '更新成功');
  }

  /**
   * 更新管理员状态
   * @param admin 当前管理员
   * @param id 管理员ID
   * @param status 状态
   * @returns {Promise<Object>} 更新后的管理员信息
   */
  @Patch(':id/status')
  @UseGuards(CombinedAuthGuard, ScopeGuard)
  @ApiBearerAuth()
  @RequireScope(AdminScope.ADMIN_WRITE)
  @ApiOperation({ summary: '更新管理员状态' })
  @SwaggerApiResponse({ status: 200, description: '更新成功' })
  async updateStatus(
    @CurrentAdmin() admin: any,
    @Param('id') id: string,
    @Body('status') status: number,
  ) {
    const result = await this.adminService.updateStatus(admin.sub, id, status);
    return success(result, '更新成功');
  }

  /**
   * 重置管理员密码
   * @param admin 当前管理员
   * @param id 管理员ID
   * @param resetPasswordDto 重置密码DTO
   * @returns {Promise<Object>} 重置结果
   */
  @Post(':id/reset-password')
  @UseGuards(CombinedAuthGuard, ScopeGuard)
  @ApiBearerAuth()
  @RequireScope(AdminScope.ADMIN_WRITE)
  @ApiOperation({ summary: '重置管理员密码' })
  @SwaggerApiResponse({ status: 200, description: '重置成功' })
  @SwaggerApiResponse({ status: 404, description: '管理员不存在' })
  async resetPassword(
    @CurrentAdmin() admin: any,
    @Param('id') id: string,
    @Body() resetPasswordDto: ResetPasswordDto,
  ) {
    await this.adminService.resetPassword(admin.sub, id, resetPasswordDto.newPassword);
    return success(null, '密码重置成功');
  }

  /**
   * 删除管理员
   * @param admin 当前管理员
   * @param id 管理员ID
   * @returns {Promise<ApiResponse<null>>}
   */
  @Delete(':id')
  @UseGuards(CombinedAuthGuard, ScopeGuard)
  @ApiBearerAuth()
  @RequireScope(AdminScope.ADMIN_WRITE)
  @ApiOperation({ summary: '删除管理员' })
  @SwaggerApiResponse({ status: 200, description: '删除成功' })
  async delete(
    @CurrentAdmin() admin: any,
    @Param('id') id: string,
  ): Promise<ApiResponse<null>> {
    await this.adminService.delete(admin.sub, id);
    return success(null, '删除成功');
  }
}
