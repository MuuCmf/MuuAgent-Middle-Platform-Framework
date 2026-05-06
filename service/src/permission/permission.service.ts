import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { GrantPermissionDto } from './dto/grant-permission.dto';
import { RevokePermissionDto } from './dto/revoke-permission.dto';
import { CheckPermissionDto } from './dto/check-permission.dto';
import {
  KbRole,
  KbPermission,
  ROLE_PERMISSIONS,
} from './constants/permission.constants';

/**
 * 权限管理服务
 */
@Injectable()
export class PermissionService {
  /**
   * 构造函数
   * @param prisma Prisma服务
   */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 授予权限
   * @param dto 授权参数
   * @returns {Promise<any>} 授权结果
   */
  async grantPermission(dto: GrantPermissionDto): Promise<any> {
    const kb = await this.prisma.kbInfo.findFirst({
      where: { id: dto.kbId, isDeleted: false },
    });

    if (!kb) {
      throw new NotFoundException('知识库不存在');
    }

    const permissions = ROLE_PERMISSIONS[dto.role];

    const permission = await this.prisma.kbPermission.upsert({
      where: {
        kbId_uid: {
          kbId: dto.kbId,
          uid: dto.targetUid,
        },
      },
      update: {
        role: dto.role,
        permissions: JSON.stringify(permissions),
        grantedBy: dto.uid,
      },
      create: {
        kbId: dto.kbId,
        uid: dto.targetUid,
        role: dto.role,
        permissions: JSON.stringify(permissions),
        grantedBy: dto.uid,
      },
    });

    return {
      id: permission.id,
      kbId: permission.kbId,
      uid: permission.uid,
      role: permission.role,
      permissions: JSON.parse(permission.permissions),
      grantedBy: permission.grantedBy,
      createdAt: permission.createdAt,
    };
  }

  /**
   * 撤销权限
   * @param dto 撤销参数
   * @returns {Promise<boolean>} 撤销结果
   */
  async revokePermission(dto: RevokePermissionDto): Promise<boolean> {
    const permission = await this.prisma.kbPermission.findFirst({
      where: { kbId: dto.kbId, uid: dto.targetUid },
    });

    if (!permission) {
      throw new NotFoundException('权限记录不存在');
    }

    await this.prisma.kbPermission.delete({
      where: { id: permission.id },
    });

    return true;
  }

  /**
   * 检查权限
   * @param dto 检查参数
   * @returns {Promise<boolean>} 是否有权限
   */
  async checkPermission(dto: CheckPermissionDto): Promise<boolean> {
    if (
      dto.permission === KbPermission.RETRIEVAL ||
      dto.permission === KbPermission.READ
    ) {
      const kb = await this.prisma.kbInfo.findFirst({
        where: { id: dto.kbId, isPublic: true, status: true, isDeleted: false },
      });

      return !!kb;
    }

    const permission = await this.prisma.kbPermission.findFirst({
      where: { kbId: dto.kbId, uid: dto.uid },
    });

    if (!permission) {
      return false;
    }

    const permissions = JSON.parse(permission.permissions) as KbPermission[];
    return permissions.includes(dto.permission);
  }

  /**
   * 获取知识库的所有权限
   * @param kbId 知识库ID
   * @returns {Promise<any[]>} 权限列表
   */
  async getKbPermissions(kbId: string): Promise<any[]> {
    const permissions = await this.prisma.kbPermission.findMany({
      where: { kbId },
      orderBy: { createdAt: 'desc' },
    });

    return permissions.map((p) => ({
      id: p.id,
      kbId: p.kbId,
      uid: p.uid,
      role: p.role,
      permissions: JSON.parse(p.permissions),
      grantedBy: p.grantedBy,
      createdAt: p.createdAt,
    }));
  }

  /**
   * 获取用户的知识库权限
   * @param kbId 知识库ID
   * @param uid 用户ID
   * @returns {Promise<any>} 用户权限
   */
  async getUserPermission(kbId: string, uid: string): Promise<any> {
    const permission = await this.prisma.kbPermission.findFirst({
      where: { kbId, uid },
    });

    if (!permission) {
      return null;
    }

    return {
      id: permission.id,
      kbId: permission.kbId,
      uid: permission.uid,
      role: permission.role,
      permissions: JSON.parse(permission.permissions),
      grantedBy: permission.grantedBy,
      createdAt: permission.createdAt,
    };
  }
}
