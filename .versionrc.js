/**
 * conventional-changelog 配置文件
 * 用于自定义 CHANGELOG 生成规则
 */

module.exports = {
  types: [
    { type: 'feat', section: '✨ 新功能' },
    { type: 'fix', section: '🐛 Bug 修复' },
    { type: 'perf', section: '⚡ 性能优化' },
    { type: 'refactor', section: '♻️ 代码重构' },
    { type: 'docs', section: '📝 文档更新' },
    { type: 'style', section: '💄 样式调整' },
    { type: 'test', section: '✅ 测试相关' },
    { type: 'build', section: '📦 构建相关' },
    { type: 'ci', section: '👷 CI/CD' },
    { type: 'chore', section: '🔧 其他修改' },
    { type: 'revert', section: '⏪ 回退更改' },
  ],
  releaseCommitMessageFormat: 'chore(release): 发布 {{currentTag}}',
  skip: {
    tag: true,
  },
  writerOpts: {
    transform: (commit, context) => {
      const issues = [];

      commit.notes.forEach((note) => {
        note.title = '💥 不兼容变更';
      });

      if (commit.scope === '*') {
        commit.scope = '';
      }

      if (typeof commit.hash === 'string') {
        commit.hash = commit.hash.substring(0, 7);
      }

      if (typeof commit.subject === 'string') {
        let url = context.repository
          ? `${context.host}/${context.owner}/${context.repository}`
          : context.repositoryUrl;
        if (url) {
          url = url.replace(/\.git$/, '');
          commit.subject = commit.subject.replace(
            /#([0-9]+)/g,
            (_, issue) => `[#${issue}](${url}/issues/${issue})`
          );
        }
        commit.subject = commit.subject;
      }

      commit.references.forEach((reference) => {
        issues.push(reference.issue);
      });

      return commit;
    },
  },
};