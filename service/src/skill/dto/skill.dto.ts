import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

/**
 * 查询标准技能列表DTO
 */
export class QueryStandardSkillDto {
  @ApiPropertyOptional({ description: '应用标识筛选' })
  @IsString()
  @IsOptional()
  appCode?: string;
}

/**
 * 验证 SKILL.md DTO
 */
export class ValidateSkillMdDto {
  @ApiProperty({ description: 'SKILL.md 完整内容' })
  @IsString()
  @IsNotEmpty()
  content: string;
}
