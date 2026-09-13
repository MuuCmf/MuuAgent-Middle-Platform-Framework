import { encryptAuthCode, decryptAuthCode } from './auth-code.util';

describe('auth-code.util（php encrypt_code/encryptDecode 兼容）', () => {
  const plain = 'www.example.com|127.0.0.1';

  it('加解密往返应还原原文', () => {
    const code = encryptAuthCode(plain, 6000);
    expect(decryptAuthCode(code)).toBe(plain);
  });

  it('不同原文生成不同密文', () => {
    const a = encryptAuthCode(plain, 6000);
    const b = encryptAuthCode('other.com|1.2.3.4', 6000);
    expect(decryptAuthCode(a)).toBe(plain);
    expect(decryptAuthCode(b)).toBe('other.com|1.2.3.4');
    expect(a).not.toBe(b);
  });

  it('expirySec=0 表示不过期', () => {
    const code = encryptAuthCode(plain, 0);
    expect(decryptAuthCode(code)).toBe(plain);
  });

  it('密文不含 "="（php base64 去等号语义）', () => {
    const code = encryptAuthCode(plain, 6000);
    expect(code.includes('=')).toBe(false);
  });

  it('篡改密文后解密返回 null', () => {
    const code = encryptAuthCode(plain, 6000);
    const tampered = code.slice(0, -2) + (code.endsWith('aa') ? 'bb' : 'aa');
    // 篡改尾部校验必然失败
    expect(decryptAuthCode(tampered)).toBeNull();
  });

  it('支持自定义密钥', () => {
    const code = encryptAuthCode(plain, 6000, 'other-key');
    expect(decryptAuthCode(code, 'other-key')).toBe(plain);
    // 默认密钥无法解密
    expect(decryptAuthCode(code)).toBeNull();
  });
});
