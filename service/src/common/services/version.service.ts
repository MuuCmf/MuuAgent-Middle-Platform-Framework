import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * 版本信息服务
 * 
 * 负责读取和管理项目版本号
 */
@Injectable()
export class VersionService {
  private version: string;

  /**
   * 构造函数
   * 从 VERSION 文件读取版本号
   */
  constructor() {
    try {
      // 从项目根目录查找 VERSION 文件
      let currentDir = __dirname;
      let versionPath: string | null = null;
      
      // 向上查找，最多查找 10 层
      for (let i = 0; i < 10; i++) {
        const testPath = join(currentDir, 'VERSION');
        try {
          const stats = require('fs').statSync(testPath);
          if (stats.isFile()) {
            versionPath = testPath;
            break;
          }
        } catch {
          // 文件不存在，继续向上查找
        }
        
        const parentDir = join(currentDir, '..');
        if (parentDir === currentDir) {
          // 已经到达根目录
          break;
        }
        currentDir = parentDir;
      }
      
      if (versionPath) {
        this.version = readFileSync(versionPath, 'utf-8').trim();
      } else {
        console.warn('未找到 VERSION 文件，使用默认版本号');
        this.version = '0.0.0';
      }
    } catch (error) {
      console.error('读取版本号失败:', error);
      this.version = '0.0.0';
    }
  }

  /**
   * 获取版本号
   * @returns {string} 版本号
   */
  getVersion(): string {
    return this.version;
  }

  /**
   * 获取版本信息
   * @returns {object} 版本信息对象
   */
  getVersionInfo() {
    return {
      version: this.version,
      name: 'MuuAgent',
      description: 'AI模型管理 + 智能调度 + Skill + Agent + RAG知识库 智能中台',
    };
  }
}
