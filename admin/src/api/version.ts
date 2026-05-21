import request from '@/utils/request';

/**
 * 版本信息接口
 */
export interface VersionInfo {
  version: string;
  name: string;
  description: string;
}

/**
 * 版本信息 API
 */
export const versionApi = {
  /**
   * 获取版本信息
   * @returns {Promise<VersionInfo>} 版本信息
   */
  async getVersion(): Promise<VersionInfo> {
    const response = await request.get('api/version');
    return response.data?.data || {};
  }
};
