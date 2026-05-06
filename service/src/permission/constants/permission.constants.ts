import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';

/**
 * 知识库权限角色枚举
 */
export enum KbRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  EDITOR = 'editor',
  VIEWER = 'viewer',
}

/**
 * 知识库权限枚举
 */
export enum KbPermission {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  UPLOAD = 'upload',
  RETRIEVAL = 'retrieval',
}

/**
 * 角色权限映射
 */
export const ROLE_PERMISSIONS: Record<KbRole, KbPermission[]> = {
  [KbRole.OWNER]: [
    KbPermission.CREATE,
    KbPermission.READ,
    KbPermission.UPDATE,
    KbPermission.DELETE,
    KbPermission.UPLOAD,
    KbPermission.RETRIEVAL,
  ],
  [KbRole.ADMIN]: [
    KbPermission.CREATE,
    KbPermission.READ,
    KbPermission.UPDATE,
    KbPermission.DELETE,
    KbPermission.UPLOAD,
    KbPermission.RETRIEVAL,
  ],
  [KbRole.EDITOR]: [
    KbPermission.READ,
    KbPermission.UPDATE,
    KbPermission.UPLOAD,
    KbPermission.RETRIEVAL,
  ],
  [KbRole.VIEWER]: [KbPermission.READ, KbPermission.RETRIEVAL],
};
