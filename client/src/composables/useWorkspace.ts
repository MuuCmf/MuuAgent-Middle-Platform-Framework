import { ref, computed } from 'vue'

interface WorkspaceFileEntry {
  name: string
  kind: 'file' | 'directory'
}

interface WorkspaceState {
  dirHandle: FileSystemDirectoryHandle | null
  dirName: string | null
  treeSummary: string | null
  isActive: boolean
}

export function useWorkspace() {
  const dirHandle = ref<FileSystemDirectoryHandle | null>(null)
  const dirName = ref<string | null>(null)
  const treeSummary = ref<string | null>(null)

  const isActive = computed(() => dirHandle.value !== null)

  async function selectDirectory(): Promise<void> {
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' })
      dirHandle.value = handle
      dirName.value = handle.name
      await refreshTreeSummary()
    } catch (err: any) {
      if (err.name === 'AbortError') return
      console.error('选择工作目录失败:', err)
      throw err
    }
  }

  async function refreshTreeSummary(): Promise<void> {
    if (!dirHandle.value) return
    treeSummary.value = await buildTreeSummary(dirHandle.value, '', 3)
  }

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

  function clear(): void {
    dirHandle.value = null
    dirName.value = null
    treeSummary.value = null
  }

  return {
    dirHandle,
    dirName,
    treeSummary,
    isActive,
    selectDirectory,
    refreshTreeSummary,
    clear,
  }
}
