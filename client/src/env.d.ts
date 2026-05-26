/// <reference types="vite/client" />

/**
 * Electron API 类型声明
 * 仅在 Electron 桌面端可用，Web 端不存在此 API
 */
interface ElectronAPI {
  /**
   * 执行桌面自动化工具
   * @param callId 调用ID
   * @param toolName 工具名称
   * @param args 工具参数
   * @returns 执行结果
   */
  executeDesktopTool(
    callId: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<{
    callId: string
    success: boolean
    result?: unknown
    error?: string
  }>

  /**
   * 打开本地文件或目录（使用系统默认应用）
   * @param filePath 文件或目录的完整路径
   * @returns 打开结果
   */
  openLocalPath(filePath: string): Promise<{
    success: boolean
    error?: string
  }>

  /**
   * 选择工作目录（使用 Electron dialog，返回完整路径）
   * @returns 目录路径和名称，用户取消时返回 null
   */
  selectDirectory(): Promise<{
    path: string
    name: string
  } | null>

  /**
   * 获取 File 对象的完整路径（Electron 28+ API）
   * @param file File 对象
   * @returns 文件完整路径
   */
  getPathForFile(file: File): string

  /**
   * 读取目录结构（返回文件树）
   * @param dirPath 目录完整路径
   * @returns 文件树节点数组
   */
  readDirTree(dirPath: string): Promise<{
    name: string
    kind: 'file' | 'directory'
    children?: any[]
    extension?: string
    relativePath: string
  }[]>
}

interface Window {
  /** Electron 主进程暴露的安全 API（仅桌面端可用） */
  electronAPI?: ElectronAPI
}

/**
 * File System Access API 的类型补充
 * FileSystemDirectoryHandle 的 entries/values/keys/asyncIterator 方法
 * 在部分 TypeScript 版本中未包含，此处进行声明合并补充
 */
interface FileSystemDirectoryHandle {
  /** 异步迭代目录中的所有条目 */
  entries(): AsyncIterableIterator<[string, FileSystemFileHandle | FileSystemDirectoryHandle]>
  /** 异步迭代目录中的所有条目名称 */
  keys(): AsyncIterableIterator<string>
  /** 异步迭代目录中的所有条目句柄 */
  values(): AsyncIterableIterator<FileSystemFileHandle | FileSystemDirectoryHandle>
  /** 异步迭代器 */
  [Symbol.asyncIterator](): AsyncIterableIterator<[string, FileSystemFileHandle | FileSystemDirectoryHandle]>
}