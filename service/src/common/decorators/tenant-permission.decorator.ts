import { SetMetadata } from '@nestjs/common';
import { TenantPermissions } from '../constants/tenant-permission.constants';

/**
 * 租户权限元数据 Key
 */
export const TENANT_PERMISSION_KEY = 'tenant:permission';

/**
 * 接口所需的租户权限声明
 */
export interface TenantPermissionRequirement {
  /** 模块名称（对应 TenantPermissions 的 key） */
  module: keyof TenantPermissions;
  /** 操作名称（对应模块权限的 key） */
  action: string;
}

/**
 * 声明接口所需的租户权限
 *
 * 用法：
 * - @RequireTenantPermission('agent', 'chat')    // 需要智能体对话权限
 * - @RequireTenantPermission('file', 'upload')   // 需要文件上传权限
 * - @RequireTenantPermission('file', 'delete')   // 需要文件删除权限
 *
 * @param module 模块名称
 * @param action 操作名称
 */
export const RequireTenantPermission = (
  module: keyof TenantPermissions,
  action: string,
) => SetMetadata(TENANT_PERMISSION_KEY, { module, action } as TenantPermissionRequirement);
