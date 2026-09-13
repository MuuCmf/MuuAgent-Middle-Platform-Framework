import * as crypto from 'crypto';

/**
 * php 兼容授权码工具
 *
 * 严格复刻 php_server/app/admin/lib/Cloud.php 的 encrypt_code 与
 * php_server/app/cloud/service/cloud/Cloud.php 的 encryptDecode 算法：
 * - key = md5('muu')，keya = md5(key 前 16 位)，keyb = md5(key 后 16 位)
 * - 明文 = 10 位到期时间戳 + md5(原文 + keyb) 前 16 位 + 原文
 * - cryptkey = keya + md5(keya + keyc)，keyc 为 1 位随机前缀字符
 * - 256 字节 box 打乱后按位直接异或（box[i]，非标准 RC4 keystream）
 * - 输出 = keyc + base64(密文) 去掉 '='
 */

const CK_KEY = 'muu';
const CKEY_LENGTH = 1;

function md5(input: string | Buffer): string {
  return crypto.createHash('md5').update(input).digest('hex');
}

/**
 * 构造与 php 一致的 256 字节打乱 box
 * @param keyc 1 位前缀字符
 */
function buildBox(keyc: string, keya: string): number[] {
  const cryptkey = keya + md5(keya + keyc);
  const keyLength = cryptkey.length; // 64

  const box: number[] = [];
  const rndkey: number[] = [];
  for (let i = 0; i <= 255; i++) {
    box[i] = i;
    // php: ord($cryptkey[$i % $key_length])，cryptkey 为 hex ASCII 字符串
    rndkey[i] = cryptkey.charCodeAt(i % keyLength);
  }

  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + box[i] + rndkey[i]) % 256;
    const tmp = box[i];
    box[i] = box[j];
    box[j] = tmp;
  }

  return box;
}

/**
 * 按位异或（php: chr(ord($string[$i]) ^ $box[$i])，box 为固定表不做二次打乱；
 * i >= 256 时 php 取到未定义索引返回 null，异或等效于不加密）
 */
function xorWithBox(data: Buffer, box: number[]): Buffer {
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) {
    const b = i < 256 ? box[i] : 0;
    out[i] = data[i] ^ b;
  }
  return out;
}

/**
 * 生成 php 兼容授权码（对应 php Cloud::encrypt_code）
 * @param plain 原文，格式为 `domain|ip`
 * @param expirySec 有效时长（秒），0 表示永不过期
 * @param key 加密密钥，需与解密端一致
 */
export function encryptAuthCode(plain: string, expirySec = 6000, key = CK_KEY): string {
  const keyMd5 = md5(key || 'muu');
  const keya = md5(keyMd5.slice(0, 16));
  const keyb = md5(keyMd5.slice(16, 32));
  // php: substr(md5(microtime()), -1)，仅作随机盐，两端由密文自身推导
  const keyc = md5(`${process.hrtime.bigint()}`).slice(-CKEY_LENGTH);

  const expiryStr = String(
    expirySec > 0 ? expirySec + Math.floor(Date.now() / 1000) : 0,
  ).padStart(10, '0');
  const plainStr = expiryStr + md5(plain + keyb).slice(0, 16) + plain;

  const box = buildBox(keyc, keya);
  const encrypted = xorWithBox(Buffer.from(plainStr, 'utf8'), box);

  return keyc + encrypted.toString('base64').replace(/=/g, '');
}

/**
 * 解密 php 端生成的授权码（对应 php Cloud::encryptDecode），返回 `domain|ip`
 * @param code 授权码
 * @param key 解密密钥，需与加密端一致
 * @returns 校验通过返回原文，失败返回 null
 */
export function decryptAuthCode(code: string, key = CK_KEY): string | null {
  if (!code || code.length <= CKEY_LENGTH) return null;

  const keyMd5 = md5(key || 'muu');
  const keya = md5(keyMd5.slice(0, 16));
  const keyb = md5(keyMd5.slice(16, 32));
  const keyc = code.slice(0, CKEY_LENGTH);

  // php base64_decode 容忍缺失 padding，需补齐
  let b64 = code.slice(CKEY_LENGTH);
  while (b64.length % 4 !== 0) b64 += '=';
  const data = Buffer.from(b64, 'base64');

  const box = buildBox(keyc, keya);
  const decrypted = xorWithBox(data, box);
  // latin1 保证字节与字符一一对应
  const result = decrypted.toString('latin1');

  if (result.length <= 26) return null;

  // php: substr($result, 0, 10) == 0 || substr($result, 0, 10) - time() > 0
  const timestamp = Number(result.slice(0, 10));
  const notExpired = timestamp === 0 || timestamp - Math.floor(Date.now() / 1000) > 0;

  // php: substr($result, 10, 16) == substr(md5(substr($result, 26) . $keyb), 0, 16)
  const checksum = result.slice(10, 26);
  const expected = md5(Buffer.concat([Buffer.from(result.slice(26), 'latin1'), Buffer.from(keyb, 'utf8')])).slice(0, 16);

  if (notExpired && checksum === expected) {
    return result.slice(26);
  }
  return null;
}
