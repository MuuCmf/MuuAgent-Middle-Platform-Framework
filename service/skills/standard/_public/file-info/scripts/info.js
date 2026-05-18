/**
 * File Info Script
 * Reads JSON { path: "..." } from stdin, returns file metadata based on the path string.
 * Note: Only analyzes the path name — does NOT access the filesystem.
 */

const input = JSON.parse(params.path || params.text || '{}');
const filePath = input.path || '';

if (!filePath || typeof filePath !== 'string') {
  return { error: 'No file path provided' };
}

// Extract file name and extension
const parts = filePath.replace(/\\/g, '/').split('/');
const fileName = parts[parts.length - 1] || filePath;
const extMatch = fileName.match(/\.([^.]+)$/);
const extension = extMatch ? '.' + extMatch[1].toLowerCase() : '';
const nameWithoutExt = extMatch ? fileName.slice(0, -(extMatch[1].length + 1)) : fileName;
const isHidden = fileName.startsWith('.');

// MIME type mapping
const mimeMap = {
  '.js': 'application/javascript',
  '.ts': 'application/typescript',
  '.py': 'text/x-python',
  '.go': 'text/x-go',
  '.java': 'text/x-java',
  '.rs': 'text/x-rust',
  '.c': 'text/x-c',
  '.cpp': 'text/x-c++',
  '.md': 'text/markdown',
  '.txt': 'text/plain',
  '.log': 'text/plain',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.zip': 'application/zip',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
  '.rar': 'application/vnd.rar',
  '.7z': 'application/x-7z-compressed',
};

// Category mapping
const categoryMap = {
  code: new Set(['.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.java', '.rs', '.c', '.cpp', '.rb', '.php', '.swift', '.kt']),
  text: new Set(['.md', '.txt', '.log', '.csv', '.json', '.xml', '.yaml', '.yml', '.toml', '.cfg', '.ini']),
  document: new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx']),
  image: new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp', '.tiff']),
  audio: new Set(['.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma']),
  video: new Set(['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv']),
  archive: new Set(['.zip', '.tar', '.gz', '.rar', '.7z', '.bz2', '.xz']),
};

let category = 'unknown';
for (const [cat, exts] of Object.entries(categoryMap)) {
  if (exts.has(extension)) {
    category = cat;
    break;
  }
}

return {
  file_name: fileName,
  extension,
  mime_type: mimeMap[extension] || 'application/octet-stream',
  category,
  is_hidden: isHidden,
  name_without_ext: nameWithoutExt,
};
