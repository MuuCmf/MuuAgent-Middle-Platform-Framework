import { Controller, Get, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ClientToolPolicyService } from './client-tool-policy.service';
import { ToolPermissionPolicy, ClientToolModulePolicy } from './client-tool-entry';
import { TenantGuard } from '../common/guards/tenant.guard';
import { success } from '../common/response/api.response';

@ApiTags('客户端工具权限')
@Controller('client-tool/policy')
@UseGuards(TenantGuard)
export class ClientToolPolicyController {
  constructor(private readonly policyService: ClientToolPolicyService) {}

  /**
   * 获取所有客户端工具模块的权限策略
   */
  @Get()
  @ApiOperation({ summary: '获取所有客户端工具权限策略' })
  getAllPolicies(): object {
    const policies = this.policyService.getAllPolicies();
    return success(policies);
  }

  /**
   * 获取指定模块的权限策略
   * @param moduleName 模块名称
   */
  @Get(':moduleName')
  @ApiOperation({ summary: '获取指定模块的权限策略' })
  getModulePolicy(@Param('moduleName') moduleName: string): object {
    const policy = this.policyService.getModulePolicy(moduleName);
    if (!policy) {
      return success(null);
    }
    return success(policy);
  }

  /**
   * 获取指定工具的权限策略
   * @param moduleName 模块名称
   * @param toolName 工具名称
   */
  @Get(':moduleName/:toolName')
  @ApiOperation({ summary: '获取指定工具的权限策略' })
  getToolPolicy(
    @Param('moduleName') moduleName: string,
    @Param('toolName') toolName: string,
  ): object {
    const policy = this.policyService.getToolPolicy(moduleName, toolName);
    return success(policy);
  }

  /**
   * 覆盖指定工具的权限策略
   * @param moduleName 模块名称
   * @param toolName 工具名称
   * @param override 策略覆盖
   */
  @Put(':moduleName/:toolName')
  @ApiOperation({ summary: '覆盖指定工具的权限策略' })
  setToolPolicyOverride(
    @Param('moduleName') moduleName: string,
    @Param('toolName') toolName: string,
    @Body() override: Partial<ToolPermissionPolicy>,
  ): object {
    this.policyService.setToolPolicyOverride(moduleName, toolName, override);
    const updated = this.policyService.getToolPolicy(moduleName, toolName);
    return success(updated);
  }

  /**
   * 覆盖指定模块的默认策略
   * @param moduleName 模块名称
   * @param override 模块策略覆盖
   */
  @Put(':moduleName')
  @ApiOperation({ summary: '覆盖指定模块的默认策略' })
  setModulePolicyOverride(
    @Param('moduleName') moduleName: string,
    @Body() override: Partial<Pick<ClientToolModulePolicy, 'defaultConfirmMode' | 'defaultTimeout'>>,
  ): object {
    this.policyService.setModulePolicyOverride(moduleName, override);
    const updated = this.policyService.getModulePolicy(moduleName);
    return success(updated);
  }

  /**
   * 删除指定工具的策略覆盖（恢复默认）
   * @param moduleName 模块名称
   * @param toolName 工具名称
   */
  @Delete(':moduleName/:toolName')
  @ApiOperation({ summary: '删除工具策略覆盖（恢复默认）' })
  deleteToolPolicyOverride(
    @Param('moduleName') moduleName: string,
    @Param('toolName') toolName: string,
  ): object {
    const deleted = this.policyService.deleteToolPolicyOverride(moduleName, toolName);
    return success({ deleted });
  }

  /**
   * 重置所有策略覆盖
   */
  @Delete()
  @ApiOperation({ summary: '重置所有策略覆盖（恢复全部默认）' })
  resetAllOverrides(): object {
    this.policyService.resetAllOverrides();
    return success({ reset: true });
  }
}
