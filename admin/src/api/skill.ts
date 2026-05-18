import { adminRequest, type ApiResponse } from '@/utils/request'
import type { AxiosResponse } from 'axios'

// ===== 标准技能类型 =====

/** 标准技能元数据（L1） */
export interface StandardSkill {
  name: string
  description: string
  source: 'filesystem'
  appCode?: string | null
  isPublic: boolean
  hasReferences: boolean
  hasScripts: boolean
  hasAssets?: boolean
  discoveredAt?: string
  fileSize?: number
}

/** 安全扫描问题 */
export interface SecurityIssue {
  level: 'critical' | 'high' | 'medium' | 'low'
  type: string
  file: string
  detail: string
  line?: number
}

/** 安全扫描结果 */
export interface SecurityScanResult {
  critical: number
  high: number
  medium: number
  low: number
  issues: SecurityIssue[]
  summary: string
  passed: boolean
}

/** 导入结果 */
export interface ImportResult {
  success: boolean
  skillName: string
  securityScan: SecurityScanResult
  validationErrors: Array<{ field: string; message: string; code: string }>
  warnings: string[]
}

/** SKILL.md 校验结果 */
export interface ValidateSkillMdResult {
  valid: boolean
  errors: Array<{ field: string; message: string; code: string }>
  warnings: string[]
  frontmatter?: Record<string, unknown>
}

/** SKILL.md 预览 */
export interface SkillMdPreview {
  skillName: string
  frontmatter: Record<string, unknown>
  body: string
  rawContent: string
}

/** 扫描结果 */
export interface ScanResult {
  skills: StandardSkill[]
  errors: Array<{ path: string; errors: Array<{ field: string; message: string; code: string }> }>
  scanDuration: number
}

// ===== API =====

export const skillApi = {
  /** 列出文件系统发现的技能 */
  listStandardSkills(appCode?: string): Promise<AxiosResponse<ApiResponse<StandardSkill[]>>> {
    const params: Record<string, string> = {}
    if (appCode) params.appCode = appCode
    return adminRequest.get('api/admin/skill/standard/list', { params })
  },

  /** 触发文件系统技能扫描 */
  scanStandardSkills(): Promise<AxiosResponse<ApiResponse<ScanResult>>> {
    return adminRequest.post('api/admin/skill/standard/scan')
  },

  /** 获取单个标准技能的 SKILL.md 预览 */
  getSkillMdPreview(name: string): Promise<AxiosResponse<ApiResponse<SkillMdPreview>>> {
    return adminRequest.get(`api/admin/skill/standard/${name}`)
  },

  /** 导入标准技能（.zip 上传，文件系统模式） */
  importSkill(
    file: File,
    options?: { appCode?: string; isPublic?: boolean; overwrite?: boolean },
  ): Promise<AxiosResponse<ApiResponse<ImportResult>>> {
    const formData = new FormData()
    formData.append('file', file)
    if (options?.appCode) formData.append('appCode', options.appCode)
    if (options?.isPublic !== undefined) formData.append('isPublic', String(options.isPublic))
    if (options?.overwrite !== undefined) formData.append('overwrite', String(options.overwrite))
    return adminRequest.post('api/admin/skill/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    })
  },

  /** 验证 SKILL.md 内容 */
  validateSkillMd(content: string): Promise<AxiosResponse<ApiResponse<ValidateSkillMdResult>>> {
    return adminRequest.post('api/admin/skill/validate', { content })
  },

  /** 刷新技能索引 */
  refreshSkills(): Promise<AxiosResponse<ApiResponse<void>>> {
    return adminRequest.post('api/admin/skill/refresh')
  },
}
