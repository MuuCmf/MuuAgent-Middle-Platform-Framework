import { Injectable, Scope } from '@nestjs/common';
import { Request } from 'express';

/**
 * 应用上下文服务
 * 
 * 管理当前请求的应用上下文信息，包括：
 * - 当前应用标识 (appCode)
 * - 认证类型 (jwt/oauth)
 * - 用户权限范围 (scope)
 * 
 * 该服务为请求级别，每个请求有独立的实例
 */
@Injectable({ scope: Scope.REQUEST })
export class AppContextService {
  /** 当前应用标识 */
  private _appCode: string | null = null;

  /** 认证类型: jwt / oauth */
  private _authType: 'jwt' | 'oauth' | null = null;

  /** 用户ID */
  private _userId: string | null = null;

  /** 权限范围 */
  private _scopes: string[] = [];

  /** 是否为超级管理员 */
  private _isSuperAdmin: boolean = false;

  /**
   * 从请求中初始化上下文
   * @param request Express请求对象
   */
  initFromRequest(request: Request): void {
    const admin = (request as any).admin;
    const user = (request as any).user;
    const authType = (request as any).authType;

    this._authType = authType || null;

    if (authType === 'jwt' && admin) {
      this._userId = admin.id;
      this._isSuperAdmin = admin.role === 'super_admin';
      this._scopes = this.parseScopes(admin.scope);
    } else if (authType === 'oauth' && user) {
      this._userId = user.userId;
      this._scopes = this.parseScopes(user.scope);
      this._appCode = user.appCode || null;
    }
  }

  /**
   * 设置应用标识
   * @param appCode 应用标识
   */
  setAppCode(appCode: string | null): void {
    this._appCode = appCode;
  }

  /**
   * 获取当前应用标识
   * @returns {string | null} 应用标识
   */
  getAppCode(): string | null {
    return this._appCode;
  }

  /**
   * 获取认证类型
   * @returns {'jwt' | 'oauth' | null} 认证类型
   */
  getAuthType(): 'jwt' | 'oauth' | null {
    return this._authType;
  }

  /**
   * 获取用户ID
   * @returns {string | null} 用户ID
   */
  getUserId(): string | null {
    return this._userId;
  }

  /**
   * 获取权限范围
   * @returns {string[]} 权限范围数组
   */
  getScopes(): string[] {
    return this._scopes;
  }

  /**
   * 检查是否为超级管理员
   * @returns {boolean} 是否为超级管理员
   */
  isSuperAdmin(): boolean {
    return this._isSuperAdmin;
  }

  /**
   * 检查是否拥有指定权限
   * @param scope 权限标识
   * @returns {boolean} 是否拥有权限
   */
  hasScope(scope: string): boolean {
    if (this._isSuperAdmin) {
      return true;
    }
    return this._scopes.includes(scope);
  }

  /**
   * 检查是否拥有任意一个指定权限
   * @param scopes 权限标识数组
   * @returns {boolean} 是否拥有任意一个权限
   */
  hasAnyScope(scopes: string[]): boolean {
    if (this._isSuperAdmin) {
      return true;
    }
    return scopes.some((scope) => this._scopes.includes(scope));
  }

  /**
   * 检查是否拥有所有指定权限
   * @param scopes 权限标识数组
   * @returns {boolean} 是否拥有所有权限
   */
  hasAllScopes(scopes: string[]): boolean {
    if (this._isSuperAdmin) {
      return true;
    }
    return scopes.every((scope) => this._scopes.includes(scope));
  }

  /**
   * 检查是否需要进行应用隔离
   * - 超级管理员不需要隔离
   * - OAuth认证已绑定应用的按应用隔离
   * @returns {boolean} 是否需要应用隔离
   */
  requireIsolation(): boolean {
    if (this._isSuperAdmin) {
      return false;
    }
    if (this._authType === 'oauth') {
      return true;
    }
    return false;
  }

  /**
   * 获取上下文摘要信息
   * @returns {object} 上下文摘要
   */
  getSummary(): {
    appCode: string | null;
    authType: 'jwt' | 'oauth' | null;
    userId: string | null;
    scopes: string[];
    isSuperAdmin: boolean;
    requireIsolation: boolean;
  } {
    return {
      appCode: this._appCode,
      authType: this._authType,
      userId: this._userId,
      scopes: this._scopes,
      isSuperAdmin: this._isSuperAdmin,
      requireIsolation: this.requireIsolation(),
    };
  }

  /**
   * 解析权限范围字符串
   * @param scopeStr 权限范围字符串（逗号分隔或JSON数组）
   * @returns {string[]} 权限范围数组
   */
  private parseScopes(scopeStr: string | string[] | undefined): string[] {
    if (!scopeStr) {
      return [];
    }
    if (Array.isArray(scopeStr)) {
      return scopeStr;
    }
    try {
      const parsed = JSON.parse(scopeStr);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return scopeStr.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
}
