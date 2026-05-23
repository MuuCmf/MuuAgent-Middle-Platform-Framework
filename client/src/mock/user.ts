/**
 * 用户角色枚举
 */
export type UserRole = 'admin' | 'developer' | 'viewer'

/**
 * 用户信息数据结构
 */
export interface UserInfo {
  /** 用户唯一标识 */
  id: string
  /** 用户名 */
  name: string
  /** 邮箱 */
  email: string
  /** 头像地址 */
  avatar: string
  /** 用户角色 */
  role: UserRole
  /** 部门 */
  department: string
}

/**
 * 角色中文映射
 */
export const roleLabelMap: Record<UserRole, string> = {
  admin: '管理员',
  developer: '开发者',
  viewer: '访客',
}

/**
 * Mock 用户列表
 */
export const mockUsers: UserInfo[] = [
  {
    id: 'u_001',
    name: '张三',
    email: 'zhangsan@muuai.com',
    avatar: '',
    role: 'admin',
    department: '技术部',
  },
  {
    id: 'u_002',
    name: '李四',
    email: 'lisi@muuai.com',
    avatar: '',
    role: 'developer',
    department: '产品部',
  },
  {
    id: 'u_003',
    name: '王五',
    email: 'wangwu@muuai.com',
    avatar: '',
    role: 'viewer',
    department: '运营部',
  },
]

/**
 * 获取当前登录用户（模拟）
 * @returns 当前用户信息
 */
export function getCurrentUser(): UserInfo {
  return mockUsers[0]
}

/**
 * 获取用户名首字母（用于头像回退）
 * @param name 用户名
 * @returns 首字母（大写）
 */
export function getInitials(name: string): string {
  return name.charAt(0).toUpperCase()
}