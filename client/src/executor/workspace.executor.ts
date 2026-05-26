import type { ClientToolCallPayload } from '../api/stream'
import type { IClientToolExecutor } from './types'

interface WorkspaceFileEntry {
  name: string
  kind: 'file' | 'directory'
}

interface ReadFileArgs {
  path: string
}

interface WriteFileArgs {
  path: string
  content: string
  mode: 'overwrite' | 'create'
}

interface AppendFileArgs {
  path: string
  content: string
}

interface CreateDirArgs {
  path: string
}

interface ReadDirArgs {
  path?: string
}

interface DeleteFileArgs {
  path: string
}

interface ResolvedPath {
  parentDir: FileSystemDirectoryHandle
  name: string
  exists: boolean
  handle?: FileSystemFileHandle | FileSystemDirectoryHandle
}

/**
 * 工作目录执行器
 * 实现工作目录的文件操作能力
 */
export class WorkspaceExecutor implements IClientToolExecutor {
  /** 模块名称 */
  moduleName = 'workspace' as const

  /** 刷新回调函数 */
  private onRefresh?: () => void

  /**
   * 构造函数
   * @param dirHandle 目录句柄
   */
  constructor(private dirHandle: FileSystemDirectoryHandle) {}

  /**
   * 设置刷新回调
   * @param callback 刷新回调函数
   */
  setRefreshCallback(callback: () => void): void {
    this.onRefresh = callback
  }

  /**
   * 执行工具调用
   * @param call 工具调用参数
   * @returns 执行结果
   */
  async execute(call: ClientToolCallPayload): Promise<{
    callId: string
    success: boolean
    result?: unknown
    error?: string
  }> {
    const { callId, toolName, args } = call
    try {
      let result: unknown
      let shouldRefresh = false

      switch (toolName) {
        case 'read_file':
          result = await this.readFile(args as unknown as ReadFileArgs)
          break
        case 'write_file':
          result = await this.writeFile(args as unknown as WriteFileArgs)
          shouldRefresh = true
          break
        case 'append_file':
          result = await this.appendFile(args as unknown as AppendFileArgs)
          shouldRefresh = true
          break
        case 'create_dir':
          result = await this.createDir(args as unknown as CreateDirArgs)
          shouldRefresh = true
          break
        case 'read_dir':
          result = await this.readDir(args as unknown as ReadDirArgs)
          break
        case 'delete_file':
          result = await this.deleteFile(args as unknown as DeleteFileArgs)
          shouldRefresh = true
          break
        default:
          return { callId, success: false, error: `未知的工作目录操作: ${toolName}` }
      }

      if (shouldRefresh && this.onRefresh) {
        this.onRefresh()
      }

      return { callId, success: true, result }
    } catch (e: any) {
      return { callId, success: false, error: e.message || '执行失败' }
    }
  }

  /**
   * 解析相对路径
   * @param relativePath 相对路径
   * @returns 解析结果
   */
  private async resolvePath(relativePath: string): Promise<ResolvedPath> {
    const parts = relativePath.split('/').filter(Boolean)
    if (parts.length === 0) {
      return { parentDir: this.dirHandle, name: '', exists: true, handle: this.dirHandle }
    }

    const name = parts.pop()!
    let currentDir = this.dirHandle
    for (const part of parts) {
      try {
        currentDir = await currentDir.getDirectoryHandle(part)
      } catch {
        currentDir = await currentDir.getDirectoryHandle(part, { create: true })
      }
    }

    let handle: FileSystemFileHandle | FileSystemDirectoryHandle | undefined
    let exists = false
    try {
      handle = await currentDir.getFileHandle(name)
      exists = true
    } catch {
      try {
        handle = await currentDir.getDirectoryHandle(name)
        exists = true
      } catch {
        // 不存在
      }
    }

    return { parentDir: currentDir, name, exists, handle }
  }

  /**
   * 读取文件
   * @param args 参数
   * @returns 文件内容
   */
  private async readFile(args: ReadFileArgs): Promise<string> {
    const { handle } = await this.resolvePath(args.path)
    if (!handle || handle.kind !== 'file') {
      throw new Error(`文件不存在: ${args.path}`)
    }
    const file = await (handle as FileSystemFileHandle).getFile()
    return await file.text()
  }

  /**
   * 写入文件
   * @param args 参数
   * @returns 写入结果
   */
  private async writeFile(args: WriteFileArgs): Promise<{ path: string; size: number }> {
    const { parentDir, name, exists } = await this.resolvePath(args.path)
    if (args.mode === 'create' && exists) {
      throw new Error(`文件已存在: ${args.path}（使用 mode: 'overwrite' 来覆盖）`)
    }
    const fileHandle = await parentDir.getFileHandle(name, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(args.content)
    await writable.close()
    const file = await fileHandle.getFile()
    return { path: args.path, size: file.size }
  }

  /**
   * 追加文件内容
   * @param args 参数
   * @returns 追加结果
   */
  private async appendFile(args: AppendFileArgs): Promise<{ path: string; size: number }> {
    const { parentDir, name, handle } = await this.resolvePath(args.path)
    const existingContent = handle && handle.kind === 'file'
      ? await (handle as FileSystemFileHandle).getFile().then(f => f.text())
      : ''
    const fileHandle = await parentDir.getFileHandle(name, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(existingContent + args.content)
    await writable.close()
    const file = await fileHandle.getFile()
    return { path: args.path, size: file.size }
  }

  /**
   * 创建目录
   * @param args 参数
   * @returns 创建结果
   */
  private async createDir(args: CreateDirArgs): Promise<{ path: string }> {
    const parts = args.path.split('/').filter(Boolean)
    let currentDir = this.dirHandle
    for (const part of parts) {
      try {
        currentDir = await currentDir.getDirectoryHandle(part)
      } catch {
        currentDir = await currentDir.getDirectoryHandle(part, { create: true })
      }
    }
    return { path: args.path }
  }

  /**
   * 读取目录
   * @param args 参数
   * @returns 目录内容列表
   */
  private async readDir(args: ReadDirArgs): Promise<WorkspaceFileEntry[]> {
    const targetPath = args.path || ''
    let dir: FileSystemDirectoryHandle

    if (!targetPath) {
      dir = this.dirHandle
    } else {
      const parts = targetPath.split('/').filter(Boolean)
      let currentDir = this.dirHandle
      for (const part of parts) {
        try {
          currentDir = await currentDir.getDirectoryHandle(part)
        } catch {
          throw new Error(`目录不存在: ${targetPath}`)
        }
      }
      dir = currentDir
    }

    const entries: WorkspaceFileEntry[] = []
    for await (const [name, entryHandle] of (dir as FileSystemDirectoryHandle).entries()) {
      entries.push({ name, kind: entryHandle.kind as 'file' | 'directory' })
    }
    entries.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    return entries
  }

  /**
   * 删除文件
   * @param args 参数
   * @returns 删除结果
   */
  private async deleteFile(args: DeleteFileArgs): Promise<{ path: string }> {
    const { parentDir, name, handle } = await this.resolvePath(args.path)
    if (!handle) throw new Error(`文件不存在: ${args.path}`)
    await parentDir.removeEntry(name)
    return { path: args.path }
  }
}