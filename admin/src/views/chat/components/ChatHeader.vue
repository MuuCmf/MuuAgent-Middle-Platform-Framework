<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">💬 AI对话</h1>
      <p class="page-description">测试AI模型、智能体和知识库检索功能</p>
    </div>
    <div class="help-tip">
      <div class="help-tip-title">💡 AI对话说明</div>
      <ul>
        <li><strong>MCP调度</strong>：系统自动选择最优模型进行对话</li>
        <li><strong>选择模型</strong>：手动指定要使用的模型</li>
        <li><strong>智能体对话</strong>：选择已创建的智能体，它会根据系统提示词和绑定的技能进行智能回复</li>
        <li><strong>知识库检索</strong>：在知识库中检索相关文档片段</li>
        <li><strong>RAG问答</strong>：基于知识库内容进行智能问答</li>
      </ul>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.page-header {
  margin-bottom: 20px;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 8px 0;
}

.page-description {
  color: #666;
  margin: 0;
}

.help-tip {
  background: #f0f7ff;
  border: 1px solid #d0e3ff;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;

  .help-tip-title {
    font-weight: 600;
    color: #2c5aa0;
    margin-bottom: 8px;
  }

  ul {
    margin: 0;
    padding-left: 20px;

    li {
      margin-bottom: 4px;
      color: #555;
      line-height: 1.6;

      &:last-child {
        margin-bottom: 0;
      }

      strong {
        color: #333;
      }
    }
  }
}
</style>
