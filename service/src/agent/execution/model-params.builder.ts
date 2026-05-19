import { Injectable, Logger } from '@nestjs/common';
import { ModelTemplateService } from '../../model-template/model-template.service';
import { mergeModelParams, ModelParams } from '../../common/utils/model-params.util';

@Injectable()
export class ModelParamsBuilder {
  private readonly logger = new Logger(ModelParamsBuilder.name);

  constructor(
    private readonly modelTemplateService: ModelTemplateService,
  ) {}

  async build(agent: { modelTemplateCode?: string; customModelParams?: any }): Promise<ModelParams> {
    let templateParams: ModelParams | null = null;
    if (agent.modelTemplateCode) {
      try {
        const template = await this.modelTemplateService.findByCode(agent.modelTemplateCode);
        templateParams = {
          temperature: template.temperature,
          topP: template.topP,
          maxTokens: template.maxTokens,
        };
      } catch {
        // 模板不存在，使用默认值
      }
    }

    let customParams: ModelParams = {};
    if (agent.customModelParams) {
      try {
        if (typeof agent.customModelParams === 'string') {
          if (agent.customModelParams.trim()) {
            customParams = JSON.parse(agent.customModelParams);
          }
        } else {
          customParams = agent.customModelParams;
        }
      } catch (error) {
        this.logger.warn(`解析自定义模型参数失败: ${error}`);
      }
    }

    return mergeModelParams({
      templateParams,
      customParams,
    });
  }
}
