import { ref, computed } from 'vue'

/**
 * 文件树节点接口
 */
export interface FileTreeNode {
  /** 节点名称 */
  name: string
  /** 节点类型：文件或目录 */
  kind: 'file' | 'directory'
  /** 子节点（仅目录有） */
  children?: FileTreeNode[]
  /** 文件句柄（仅 Web 环境，Electron 环境为 null） */
  handle?: FileSystemFileHandle | FileSystemDirectoryHandle
  /** 文件扩展名（仅文件有） */
  extension?: string
  /** 相对于工作目录的路径 */
  relativePath: string
}

export function useWorkspace() {
  /** 目录句柄 */
  const dirHandle = ref<FileSystemDirectoryHandle | null>(null)
  /** 目录名称 */
  const dirName = ref<string | null>(null)
  /** 目录完整路径（仅 Electron 环境） */
  const dirPath = ref<string | null>(null)
  /** 树形摘要（字符串格式） */
  const treeSummary = ref<string | null>(null)
  /** 结构化文件树 */
  const fileTree = ref<FileTreeNode[]>([])
  /** 是否正在加载 */
  const isLoading = ref(false)

  /** 是否已激活工作目录（Electron 环境检查 dirPath，Web 环境检查 dirHandle） */
  const isActive = computed(() => dirPath.value !== null || dirHandle.value !== null)

  /**
   * 选择工作目录
   * Electron 环境：使用 Electron dialog 获取完整路径，通过 IPC 读取文件树
   * Web 环境：使用 showDirectoryPicker，无法获取完整路径
   */
  async function selectDirectory(): Promise<void> {
    try {
      // Electron 环境：使用 Electron dialog（一次弹窗）
      if (window.electronAPI?.selectDirectory && window.electronAPI?.readDirTree) {
        const result = await window.electronAPI.selectDirectory()
        if (!result) return // 用户取消
        
        dirPath.value = result.path
        dirName.value = result.name
        dirHandle.value = null // Electron 环境不需要 handle
        
        isLoading.value = true
        try {
          // 通过 IPC 从主进程读取文件树
          fileTree.value = await window.electronAPI.readDirTree(result.path)
          // 构建简单的树形摘要
          treeSummary.value = buildSimpleTreeSummary(fileTree.value, '', 3)
        } catch (err) {
          console.error('[Workspace] 读取文件树失败:', err)
          fileTree.value = []
        } finally {
          isLoading.value = false
        }
      } else {
        // Web 环境：使用 File System Access API
        const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' })
        dirHandle.value = handle
        dirName.value = handle.name
        dirPath.value = null
        
        await refreshTreeSummary()
        await refreshFileTree()
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return
      console.error('选择工作目录失败:', err)
      throw err
    }
  }

  /**
   * 构建简单的树形摘要（用于 Electron 环境）
   * @param nodes 文件树节点
   * @param prefix 前缀
   * @param maxDepth 最大深度
   * @returns 树形摘要字符串
   */
  function buildSimpleTreeSummary(nodes: FileTreeNode[], prefix: string, maxDepth: number): string {
    if (maxDepth <= 0) return prefix + '...\n'
    let result = ''
    for (const node of nodes) {
      if (node.kind === 'directory') {
        result += `${prefix}${node.name}/\n`
        if (node.children) {
          result += buildSimpleTreeSummary(node.children, prefix + '  ', maxDepth - 1)
        }
      } else {
        result += `${prefix}${node.name}\n`
      }
    }
    return result
  }

  /**
   * 刷新树形摘要
   */
  async function refreshTreeSummary(): Promise<void> {
    if (!dirHandle.value) return
    treeSummary.value = await buildTreeSummary(dirHandle.value, '', 3)
  }

  /**
   * 构建树形摘要字符串
   * @param dir 目录句柄
   * @param prefix 前缀
   * @param maxDepth 最大深度
   * @returns 树形摘要字符串
   */
  async function buildTreeSummary(
    dir: FileSystemDirectoryHandle | FileSystemFileHandle,
    prefix: string,
    maxDepth: number,
  ): Promise<string> {
    if (maxDepth <= 0) return prefix + '...\n'
    if (dir.kind === 'file') return ''
    let result = ''
    const dirHandle = dir as FileSystemDirectoryHandle
    for await (const [name, handle] of dirHandle.entries()) {
      if (handle.kind === 'directory') {
        result += `${prefix}${name}/\n`
        result += await buildTreeSummary(handle, prefix + '  ', maxDepth - 1)
      } else {
        result += `${prefix}${name}\n`
      }
    }
    return result
  }

  /**
   * 刷新文件树
   * Electron 环境：通过 IPC 从主进程读取
   * Web 环境：通过 File System Access API 读取
   */
  async function refreshFileTree(): Promise<void> {
    // Electron 环境：使用 IPC 读取
    if (dirPath.value && window.electronAPI?.readDirTree) {
      isLoading.value = true
      try {
        fileTree.value = await window.electronAPI.readDirTree(dirPath.value)
      } catch (err) {
        console.error('[Workspace] 读取文件树失败:', err)
        fileTree.value = []
      } finally {
        isLoading.value = false
      }
      return
    }
    
    // Web 环境：使用 File System Access API
    if (!dirHandle.value) {
      fileTree.value = []
      return
    }
    isLoading.value = true
    try {
      fileTree.value = await buildFileTree(dirHandle.value, '')
    } catch (err) {
      console.error('构建文件树失败:', err)
      fileTree.value = []
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 构建文件树
   * @param dir 目录句柄
   * @param prefix 相对路径前缀
   * @returns 文件树节点数组
   */
  async function buildFileTree(dir: FileSystemDirectoryHandle, prefix: string): Promise<FileTreeNode[]> {
    const nodes: FileTreeNode[] = []
    const entries: [string, FileSystemHandle][] = []

    for await (const entry of dir.entries()) {
      entries.push(entry)
    }

    entries.sort((a, b) => {
      if (a[1].kind !== b[1].kind) {
        return a[1].kind === 'directory' ? -1 : 1
      }
      return a[0].localeCompare(b[0])
    })

    for (const [name, handle] of entries) {
      const typedHandle = handle.kind === 'file' 
        ? handle as FileSystemFileHandle 
        : handle as FileSystemDirectoryHandle
      
      const relativePath = prefix ? `${prefix}/${name}` : name
      
      const node: FileTreeNode = {
        name,
        kind: handle.kind as 'file' | 'directory',
        handle: typedHandle,
        relativePath,
      }

      if (handle.kind === 'file') {
        const ext = name.split('.').pop()?.toLowerCase()
        if (ext && ext !== name.toLowerCase()) {
          node.extension = ext
        }
      } else {
        node.children = await buildFileTree(typedHandle as FileSystemDirectoryHandle, relativePath)
      }

      nodes.push(node)
    }

    return nodes
  }

  /**
   * 清除工作目录
   */
  function clear(): void {
    dirHandle.value = null
    dirName.value = null
    dirPath.value = null
    treeSummary.value = null
    fileTree.value = []
    isLoading.value = false
  }

  /**
   * 获取文件节点的完整路径
   * 通过拼接工作目录路径和节点相对路径获取
   * @param node 文件节点
   * @returns 文件完整路径，如果无法获取则返回 null
   */
  function getFilePath(node: FileTreeNode): string | null {
    if (node.kind !== 'file') return null
    if (!dirPath.value) return null
    // 拼接工作目录路径和相对路径
    return `${dirPath.value}/${node.relativePath}`
  }

  return {
    dirHandle,
    dirName,
    dirPath,
    treeSummary,
    fileTree,
    isLoading,
    isActive,
    selectDirectory,
    refreshTreeSummary,
    refreshFileTree,
    clear,
    getFilePath,
  }
}