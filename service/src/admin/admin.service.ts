import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { QueryAdminDto } from './dto/query-admin.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AdminUser } from '@prisma/client';

/**
 * 管理员服务
 */
@Injectable()
export class AdminService {
  /**
   * 构造函数
   * @param prisma Prisma服务
   * @param jwtService JWT服务
   * @param configService 配置服务
   */
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * 生成刷新令牌
   * @param adminId 管理员ID
   * @returns {Promise<string>} 刷新令牌
   */
  private async generateRefreshToken(adminId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('base64url');

    const expiresIn = this.configService.get<string>('REFRESH_TOKEN_EXPIRES_IN') || '7d';
    const expiresAt = this.calculateExpiresAt(expiresIn);

    await this.prisma.adminRefreshToken.create({
      data: {
        adminId: adminId as any,
        token,
        expiresAt,
      },
    });

    return token;
  }

  /**
   * 计算过期时间
   * @param expiresIn 过期时间字符串 (如: 7d, 24h, 60m)
   * @returns {Date} 过期时间
   */
  private calculateExpiresAt(expiresIn: string): Date {
    const unit = expiresIn.slice(-1);
    const value = parseInt(expiresIn.slice(0, -1));

    const now = new Date();
    switch (unit) {
      case 'd':
        return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
      case 'h':
        return new Date(now.getTime() + value * 60 * 60 * 1000);
      case 'm':
        return new Date(now.getTime() + value * 60 * 1000);
      default:
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
  }

  /**
   * 清理过期的刷新令牌
   * @param adminId 管理员ID
   * @returns {Promise<void>}
   */
  private async cleanExpiredRefreshTokens(adminId: string): Promise<void> {
    await this.prisma.adminRefreshToken.deleteMany({
      where: {
        adminId: adminId as any,
        expiresAt: {
          lt: new Date(),
        },
      },
    });
  }

  /**
   * 管理员登录
   * @param loginDto 登录DTO
   * @param clientIp 客户端IP
   * @returns {Promise<{accessToken: string, refreshToken: string, admin: Partial<AdminUser>}>} 登录结果
   */
  async login(
    loginDto: LoginDto,
    clientIp: string,
  ): Promise<{ accessToken: string; refreshToken: string; admin: Partial<AdminUser> }> {
    const { username, password } = loginDto;

    const admin = await this.prisma.adminUser.findUnique({
      where: { username },
    });

    if (!admin) {
      throw new UnauthorizedException('账号或密码错误');
    }

    if (admin.status === 0) {
      throw new UnauthorizedException('账号已被禁用');
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('账号或密码错误');
    }

    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: clientIp,
      },
    });

    await this.cleanExpiredRefreshTokens(admin.id as any);

    const payload = {
      sub: admin.id as any,
      username: admin.username,
      role: admin.role,
      isSuperAdmin: admin.isSuperAdmin,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = await this.generateRefreshToken(admin.id as any);

    const { password: _, ...adminWithoutPassword } = admin;

    return {
      accessToken,
      refreshToken,
      admin: adminWithoutPassword,
    };
  }

  /**
   * 管理员登出
   * @param adminId 管理员ID
   * @param refreshToken 刷新令牌
   * @returns {Promise<void>}
   */
  async logout(adminId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await this.prisma.adminRefreshToken.deleteMany({
        where: {
          adminId: adminId as any,
          token: refreshToken,
        },
      }).catch(() => {});
    } else {
      await this.prisma.adminRefreshToken.deleteMany({
        where: {
          adminId: adminId as any,
        },
      }).catch(() => {});
    }
  }

  /**
   * 刷新访问令牌
   * @param refreshToken 刷新令牌
   * @returns {Promise<{accessToken: string, refreshToken: string}>} 新的令牌对
   */
  async refreshToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const storedToken = await this.prisma.adminRefreshToken.findUnique({
      where: { token: refreshToken },
      include: {
        admin: true,
      },
    });

    if (!storedToken) {
      throw new UnauthorizedException('无效的刷新令牌');
    }

    if (storedToken.expiresAt < new Date()) {
      await this.prisma.adminRefreshToken.delete({
        where: { token: refreshToken },
      });
      throw new UnauthorizedException('刷新令牌已过期');
    }

    if (storedToken.admin.status === 0) {
      throw new UnauthorizedException('账号已被禁用');
    }

    await this.prisma.adminRefreshToken.delete({
      where: { token: refreshToken },
    });

    const payload = {
      sub: storedToken.admin.id,
      username: storedToken.admin.username,
      role: storedToken.admin.role,
      isSuperAdmin: storedToken.admin.isSuperAdmin,
    };

    const accessToken = this.jwtService.sign(payload);
    const newRefreshToken = await this.generateRefreshToken(storedToken.admin.id as any);

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * 创建管理员
   * @param operatorId 操作者ID
   * @param operatorIsSuperAdmin 操作者是否为超管
   * @param createAdminDto 创建管理员DTO
   * @returns {Promise<Partial<AdminUser>>} 创建的管理员信息
   */
  async createAdmin(operatorId: string, operatorIsSuperAdmin: boolean, createAdminDto: CreateAdminDto): Promise<Partial<AdminUser>> {
    const { username, password, ...rest } = createAdminDto;

    const existingAdmin = await this.prisma.adminUser.findUnique({
      where: { username },
    });

    if (existingAdmin) {
      throw new ConflictException('账号已存在');
    }

    if (rest.role === 'admin' && !operatorIsSuperAdmin) {
      throw new ForbiddenException('只有超级管理员才能创建超管账号');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await this.prisma.adminUser.create({
      data: {
        username,
        password: hashedPassword,
        ...rest,
      },
    });

    const { password: _, ...adminWithoutPassword } = admin;

    return adminWithoutPassword;
  }

  /**
   * 根据ID获取管理员
   * @param id 管理员ID
   * @returns {Promise<AdminUser>} 管理员信息
   */
  async findById(id: string): Promise<AdminUser> {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: id as any },
    });

    if (!admin) {
      throw new NotFoundException('管理员不存在');
    }

    return admin;
  }

  /**
   * 分页查询管理员列表
   * @param query 查询参数
   * @returns {Promise<{list: Partial<AdminUser>[], total: number, page: number, pageSize: number}>} 分页结果
   */
  async findPage(query: QueryAdminDto): Promise<{
    list: Partial<AdminUser>[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const { page = 1, pageSize = 10, keyword, role, status } = query;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (keyword) {
      where.OR = [
        { username: { contains: keyword } },
        { nickname: { contains: keyword } },
      ];
    }

    if (role) {
      where.role = role;
    }

    if (status !== undefined) {
      where.status = status;
    }

    const [list, total] = await Promise.all([
      this.prisma.adminUser.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.adminUser.count({ where }),
    ]);

    return {
      list: list.map(({ password, ...admin }) => admin),
      total,
      page,
      pageSize,
    };
  }

  /**
   * 获取管理员列表（全量）
   * @returns {Promise<Partial<AdminUser>[]>} 管理员列表
   */
  async findAll(): Promise<Partial<AdminUser>[]> {
    const admins = await this.prisma.adminUser.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return admins.map(({ password, ...admin }) => admin);
  }

  /**
   * 更新管理员信息
   * @param operatorId 操作者ID
   * @param operatorIsSuperAdmin 操作者是否为超管
   * @param id 管理员ID
   * @param updateAdminDto 更新管理员DTO
   * @returns {Promise<Partial<AdminUser>>} 更新后的管理员信息
   */
  async update(operatorId: string, operatorIsSuperAdmin: boolean, id: string, updateAdminDto: UpdateAdminDto): Promise<Partial<AdminUser>> {
    const target = await this.findById(id);

    if (target.isSuperAdmin && operatorId !== id) {
      throw new ForbiddenException('不能修改超级管理员信息');
    }

    if (updateAdminDto.role === 'admin' && !operatorIsSuperAdmin) {
      throw new ForbiddenException('只有超级管理员才能将角色设为超管');
    }

    const admin = await this.prisma.adminUser.update({
      where: { id: id as any },
      data: updateAdminDto,
    });

    const { password: _, ...adminWithoutPassword } = admin;

    return adminWithoutPassword;
  }

  /**
   * 更新管理员状态
   * @param operatorId 操作者ID
   * @param id 管理员ID
   * @param status 状态
   * @returns {Promise<Partial<AdminUser>>} 更新后的管理员信息
   */
  async updateStatus(operatorId: string, id: string, status: number): Promise<Partial<AdminUser>> {
    const target = await this.findById(id);

    if (target.isSuperAdmin) {
      throw new ForbiddenException('不能修改超级管理员状态');
    }

    if (operatorId === id && status === 0) {
      throw new BadRequestException('不能禁用自己');
    }

    const admin = await this.prisma.adminUser.update({
      where: { id: id as any },
      data: { status },
    });

    const { password: _, ...adminWithoutPassword } = admin;

    return adminWithoutPassword;
  }

  /**
   * 删除管理员
   * @param operatorId 操作者ID
   * @param id 管理员ID
   * @returns {Promise<void>}
   */
  async delete(operatorId: string, id: string): Promise<void> {
    if (operatorId === id) {
      throw new BadRequestException('不能删除自己');
    }

    const target = await this.findById(id);

    if (target.isSuperAdmin) {
      throw new ForbiddenException('不能删除超级管理员');
    }

    await this.prisma.adminRefreshToken.deleteMany({
      where: { adminId: id as any },
    }).catch(() => {});

    await this.prisma.adminUser.delete({
      where: { id: id as any },
    });
  }

  /**
   * 修改密码
   * @param id 管理员ID
   * @param changePasswordDto 修改密码DTO
   * @returns {Promise<void>}
   */
  async changePassword(
    id: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<void> {
    const admin = await this.findById(id);

    const isPasswordValid = await bcrypt.compare(
      changePasswordDto.oldPassword,
      admin.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('原密码错误');
    }

    const hashedPassword = await bcrypt.hash(changePasswordDto.newPassword, 10);

    await this.prisma.adminUser.update({
      where: { id: id as any },
      data: { password: hashedPassword },
    });
  }

  /**
   * 重置密码（管理员为其他管理员重置）
   * @param operatorId 操作者ID
   * @param id 管理员ID
   * @param newPassword 新密码
   * @returns {Promise<void>}
   */
  async resetPassword(operatorId: string, id: string, newPassword: string): Promise<void> {
    const target = await this.findById(id);

    if (target.isSuperAdmin && operatorId !== id) {
      throw new ForbiddenException('不能重置超级管理员密码');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.adminUser.update({
      where: { id: id as any },
      data: { password: hashedPassword },
    });

    await this.prisma.adminRefreshToken.deleteMany({
      where: { adminId: id as any },
    }).catch(() => {});
  }
}
