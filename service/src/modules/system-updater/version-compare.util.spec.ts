import { versionContrast, checkUpgradeable } from './version-compare.util';

describe('version-compare.util（复刻 php version_contrast/get_upgrade_status 语义）', () => {
  describe('versionContrast', () => {
    it('云端分段更大时返回云端版本', () => {
      expect(versionContrast('1.0.0', '1.0.1')).toBe('1.0.1');
      expect(versionContrast('1.0.9', '1.1.0')).toBe('1.1.0');
      expect(versionContrast('2.0.0', '10.0.0')).toBe('10.0.0');
    });

    it('本地分段更大时返回本地版本', () => {
      expect(versionContrast('1.0.1', '1.0.0')).toBe('1.0.1');
      expect(versionContrast('2.1.0', '2.0.9')).toBe('2.1.0');
    });

    it('完全相等时返回 versionA（php 语义）', () => {
      expect(versionContrast('1.0.0', '1.0.0')).toBe('1.0.0');
    });

    it('缺失段按 0 处理（2.0 与 2.0.0 相等）', () => {
      expect(versionContrast('2.0', '2.0.0')).toBe('2.0');
      expect(versionContrast('2.0', '2.0.1')).toBe('2.0.1');
    });
  });

  describe('checkUpgradeable', () => {
    it('云端版本更高时返回 true', () => {
      expect(checkUpgradeable('1.0.0', '1.0.1')).toBe(true);
      expect(checkUpgradeable('1.9.9', '2.0.0')).toBe(true);
    });

    it('版本相等返回 false', () => {
      expect(checkUpgradeable('1.0.0', '1.0.0')).toBe(false);
      expect(checkUpgradeable('2.0', '2.0.0')).toBe(false);
    });

    it('云端版本更低返回 false', () => {
      expect(checkUpgradeable('1.0.1', '1.0.0')).toBe(false);
      expect(checkUpgradeable('3.0.0', '2.9.9')).toBe(false);
    });

    it('版本号为空返回 false', () => {
      expect(checkUpgradeable('', '1.0.0')).toBe(false);
      expect(checkUpgradeable('1.0.0', '')).toBe(false);
    });
  });
});
