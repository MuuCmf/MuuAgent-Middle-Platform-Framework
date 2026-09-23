import * as crypto from 'crypto';

/**
 * 计算密钥的 SHA-256 哈希（hex，64字符）
 * 用于租户 apiKey 与 OAuth clientSecret 的不可逆存储：
 * - 输入为高熵随机值（非用户密码），SHA-256 足够安全且无暴力破解价值
 * - 支持对哈希建唯一索引，校验时可按哈希精确查询，性能与明文索引一致
 * @param secret 明文密钥
 * @returns {string} SHA-256 哈希（hex）
 */
export function hashSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret, 'utf8').digest('hex');
}
