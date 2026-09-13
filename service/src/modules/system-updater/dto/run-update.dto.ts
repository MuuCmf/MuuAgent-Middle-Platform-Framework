import { IsBoolean, IsOptional, IsString } from 'class-validator';

/**
 * 执行在线更新参数
 */
export class RunUpdateDto {
  /** 指定目标版本，缺省取云端最新版本 */
  @IsOptional()
  @IsString()
  version?: string;

  /** 预览模式：仅返回待更新文件清单，不落盘 */
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
