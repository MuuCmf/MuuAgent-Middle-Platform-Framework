import { SetMetadata } from '@nestjs/common';
import { AdminScope } from '../constants/scope.constants';

/**
 * Scope 元数据 Key
 */
export const REQUIRED_SCOPE_KEY = 'requiredScope';

/**
 * 声明接口所需的 Scope 权限
 *
 * 用法：
 * - 单个 scope：@RequireScope(AdminScope.MODEL_READ)
 * - 多个 scope（需同时满足）：@RequireScope(AdminScope.KB_READ, AdminScope.DOCUMENT_READ)
 * - 写操作：@RequireScope(AdminScope.MODEL_WRITE)
 *
 * 注意：ScopeGuard 会自动展开层级关系，拥有 model:write 的用户也满足 model:read 的要求
 *
 * @param scopes 所需的 scope 列表（需全部满足）
 */
export const RequireScope = (...scopes: AdminScope[]) =>
  SetMetadata(REQUIRED_SCOPE_KEY, scopes);
