/// <reference types="vite/client" />

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