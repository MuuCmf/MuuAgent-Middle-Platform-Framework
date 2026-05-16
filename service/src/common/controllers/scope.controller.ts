import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  AdminScope,
  SCOPE_DESCRIPTIONS,
  SCOPE_HIERARCHY,
  SCOPE_GROUPS,
} from '../constants/scope.constants';
import { success } from '../response/api.response';
import { CombinedAuthGuard } from '../guards/combined-auth.guard';

/**
 * Scope 元数据响应接口
 */
interface ScopeMetadataResponse {
  scopes: string[];
  descriptions: Record<string, string>;
  hierarchy: Record<string, string[]>;
  groups: Array<{ label: string; scopes: AdminScope[] }>;
}

/**
 * Scope 标签映射响应接口
 */
interface ScopeLabelsResponse {
  labels: Record<string, string>;
}

/**
 * Scope 元数据控制器
 * 提供前端获取 scope 定义的能力，实现前后端数据统一
 */
@ApiTags('Scope 元数据')
@Controller('scope')
export class ScopeController {
  /**
   * 获取所有 Scope 定义（公开接口）
   * 用于授权页面等无需登录的场景
   * @returns {Object} Scope 元数据
   */
  @Get('metadata')
  @ApiOperation({ summary: '获取 Scope 元数据（公开）' })
  async getPublicScopeMetadata(): Promise<ScopeMetadataResponse> {
    return {
      scopes: Object.values(AdminScope),
      descriptions: SCOPE_DESCRIPTIONS,
      hierarchy: SCOPE_HIERARCHY,
      groups: SCOPE_GROUPS,
    };
  }

  /**
   * 获取所有 Scope 定义（需要认证）
   * 用于管理后台等需要登录的场景
   * @returns {Object} Scope 元数据
   */
  @Get('admin/metadata')
  @UseGuards(CombinedAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取 Scope 元数据（需认证）' })
  async getAdminScopeMetadata(): Promise<ScopeMetadataResponse> {
    return {
      scopes: Object.values(AdminScope),
      descriptions: SCOPE_DESCRIPTIONS,
      hierarchy: SCOPE_HIERARCHY,
      groups: SCOPE_GROUPS,
    };
  }

  /**
   * 获取 Scope 分组（公开接口）
   * 用于前端选择器等场景
   * @returns {Object} Scope 分组数据
   */
  @Get('groups')
  @ApiOperation({ summary: '获取 Scope 分组（公开）' })
  async getPublicScopeGroups() {
    return success(SCOPE_GROUPS);
  }

  /**
   * 获取 Scope 分组（需要认证）
   * @returns {Object} Scope 分组数据
   */
  @Get('admin/groups')
  @UseGuards(CombinedAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取 Scope 分组（需认证）' })
  async getAdminScopeGroups() {
    return success(SCOPE_GROUPS);
  }

  /**
   * 获取 Scope 标签映射（公开接口）
   * 用于前端显示中文标签
   * @returns {Object} Scope 标签映射
   */
  @Get('labels')
  @ApiOperation({ summary: '获取 Scope 标签映射（公开）' })
  async getScopeLabels(): Promise<ScopeLabelsResponse> {
    const labels: Record<string, string> = {};

    Object.values(AdminScope).forEach((scope) => {
      const [module, action] = scope.split(':');
      const actionMap: Record<string, string> = {
        read: '读取',
        write: '写入',
        execute: '执行',
      };
      labels[scope] = `${module}-${actionMap[action] || action}`;
    });

    return { labels };
  }

  /**
   * 获取 Scope 描述（公开接口）
   * @returns {Object} Scope 描述映射
   */
  @Get('descriptions')
  @ApiOperation({ summary: '获取 Scope 描述映射（公开）' })
  async getScopeDescriptions() {
    return success(SCOPE_DESCRIPTIONS);
  }
}
