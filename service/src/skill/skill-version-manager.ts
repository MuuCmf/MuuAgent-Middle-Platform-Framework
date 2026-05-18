import { Injectable, Logger } from '@nestjs/common';
import { SkillRegistry, SkillDescriptor } from './skill-registry';
import { SkillFrontmatter, SkillVersion } from './standard/skill-md-validator';
import { IsolationContext } from '../common/services/base-isolated.service';

/**
 * 技能版本信息
 */
export interface SkillVersionInfo {
  name: string;
  version: string;
  title?: string;
  changelog?: string;
  descriptor: SkillDescriptor;
}

/**
 * 版本比较结果
 */
export type VersionComparison = 'lt' | 'eq' | 'gt';

/**
 * 技能版本管理器
 * 支持技能的多版本管理和版本选择
 */
@Injectable()
export class SkillVersionManager {
  private readonly logger = new Logger(SkillVersionManager.name);

  constructor(private readonly skillRegistry: SkillRegistry) {}

  /**
   * 获取技能的所有版本
   * @param skillName 技能名称
   * @param context 隔离上下文
   * @returns 版本列表
   */
  async getVersions(skillName: string, context?: IsolationContext): Promise<SkillVersionInfo[]> {
    const descriptor = await this.skillRegistry.resolve(skillName, context);
    if (!descriptor) {
      return [];
    }

    const versions: SkillVersionInfo[] = [];

    if (descriptor.frontmatter?.version) {
      const fm = descriptor.frontmatter;
      const version = fm.version!;
      versions.push({
        name: skillName,
        version,
        title: fm.versions?.find(v => v.version === version)?.title,
        changelog: fm.versions?.find(v => v.version === version)?.changelog,
        descriptor,
      });
    }

    return versions;
  }

  /**
   * 获取指定版本的技能
   * @param skillName 技能名称
   * @param version 版本号（语义化版本）
   * @param context 隔离上下文
   * @returns 技能描述符
   */
  async getVersion(skillName: string, version: string, context?: IsolationContext): Promise<SkillDescriptor | null> {
    const descriptor = await this.skillRegistry.resolve(skillName, context);
    if (!descriptor) {
      return null;
    }

    const currentVersion = descriptor.frontmatter?.version;
    if (!currentVersion) {
      return descriptor;
    }

    const comparison = this.compareVersions(currentVersion, version);
    if (comparison === 'eq') {
      return descriptor;
    }

    this.logger.warn(`技能 ${skillName} 请求版本 ${version}，但当前只有版本 ${currentVersion}`);
    return null;
  }

  /**
   * 获取最新版本的技能
   * @param skillName 技能名称
   * @param context 隔离上下文
   * @returns 最新版本的技能描述符
   */
  async getLatestVersion(skillName: string, context?: IsolationContext): Promise<SkillDescriptor | null> {
    return this.skillRegistry.resolve(skillName, context);
  }

  /**
   * 根据版本约束选择技能版本
   * @param skillName 技能名称
   * @param constraint 版本约束（如 ^1.0.0, ~1.0.0, >=1.0.0）
   * @param context 隔离上下文
   * @returns 匹配的技能描述符
   */
  async resolveVersion(skillName: string, constraint: string, context?: IsolationContext): Promise<SkillDescriptor | null> {
    const versions = await this.getVersions(skillName, context);
    if (versions.length === 0) {
      return null;
    }

    if (versions.length === 1) {
      return versions[0].descriptor;
    }

    const matched = versions.find(v => this.satisfiesConstraint(v.version, constraint));
    return matched?.descriptor || versions[0].descriptor;
  }

  /**
   * 比较两个版本
   * @param v1 版本1
   * @param v2 版本2
   * @returns 比较结果
   */
  compareVersions(v1: string, v2: string): VersionComparison {
    const parts1 = v1.split('.').map(p => parseInt(p.replace(/[^0-9]/g, ''), 10));
    const parts2 = v2.split('.').map(p => parseInt(p.replace(/[^0-9]/g, ''), 10));

    const maxLen = Math.max(parts1.length, parts2.length);
    for (let i = 0; i < maxLen; i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 < p2) return 'lt';
      if (p1 > p2) return 'gt';
    }
    return 'eq';
  }

  /**
   * 检查版本是否满足约束
   * @param version 版本号
   * @param constraint 版本约束
   * @returns 是否满足
   */
  satisfiesConstraint(version: string, constraint: string): boolean {
    if (!constraint || constraint === '*' || constraint === 'latest') {
      return true;
    }

    if (constraint.startsWith('^')) {
      return this.satisfiesCaretConstraint(version, constraint.slice(1));
    }

    if (constraint.startsWith('~')) {
      return this.satisfiesTildeConstraint(version, constraint.slice(1));
    }

    if (constraint.startsWith('>=')) {
      return this.compareVersions(version, constraint.slice(2)) !== 'lt';
    }

    if (constraint.startsWith('>')) {
      return this.compareVersions(version, constraint.slice(1)) === 'gt';
    }

    if (constraint.startsWith('<=')) {
      return this.compareVersions(version, constraint.slice(2)) !== 'gt';
    }

    if (constraint.startsWith('<')) {
      return this.compareVersions(version, constraint.slice(1)) === 'lt';
    }

    return version === constraint;
  }

  private satisfiesCaretConstraint(version: string, base: string): boolean {
    const baseParts = base.split('.').map(p => parseInt(p.replace(/[^0-9]/g, ''), 10));
    const versionParts = version.split('.').map(p => parseInt(p.replace(/[^0-9]/g, ''), 10));

    if (baseParts[0] > 0) {
      return versionParts[0] === baseParts[0] &&
        versionParts[1] >= baseParts[1] &&
        versionParts[2] >= baseParts[2];
    }

    return versionParts[0] === baseParts[0] &&
      versionParts[1] === baseParts[1] &&
      versionParts[2] >= baseParts[2];
  }

  private satisfiesTildeConstraint(version: string, base: string): boolean {
    const baseParts = base.split('.').map(p => parseInt(p.replace(/[^0-9]/g, ''), 10));
    const versionParts = version.split('.').map(p => parseInt(p.replace(/[^0-9]/g, ''), 10));

    return versionParts[0] === baseParts[0] &&
      versionParts[1] === baseParts[1] &&
      versionParts[2] >= baseParts[2];
  }

  /**
   * 解析带版本的技能名称
   * @param skillSpec 技能规范（如 skill-name@1.0.0）
   * @returns 技能名称和版本约束
   */
  parseSkillSpec(skillSpec: string): { name: string; version?: string } {
    const match = skillSpec.match(/^([^@]+)(?:@(.+))?$/);
    if (!match) {
      return { name: skillSpec };
    }
    return {
      name: match[1],
      version: match[2],
    };
  }
}
