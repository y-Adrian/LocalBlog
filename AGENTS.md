# 项目维护说明

这是 Adrian 的 Quartz v4 个人博客。内容在 `content/`，站点代码在 `quartz/`，配套实验源码在 `labs/`，参考文档在 `docs/`。

## 项目技能

- 技术正文写作：`.agents/skills/blog-writing/SKILL.md`。
- 机制、数据流、时序与状态图：`.agents/skills/blog-diagrams/SKILL.md`。
- 只修改导航、布局或链接时，不套用正文写作和配图要求。

## 构建与维护

- Node 和 npm 版本遵守 `package.json` engines；安装使用 `npm ci`。
- 构建使用 `npx quartz build`；预览使用 `npx quartz build --serve`，默认 `http://localhost:8080`。
- 测试使用 `npm test`；优先选择与本次修改相关的测试。
- `CustomOgImages` 未启用，因为构建时需要联网下载字体。
- `npm run clean` 清除生成页面、编译缓存和实验产物；保留依赖、正文及内容备份。清理任务验证构建后应再执行清理，避免遗留验证产物。

## 修改后检查与沟通

- 对照用户需求和本次 diff，检查路径、页面范围、未使用引用及调试残留。
- 修改组件、布局、配置或构建脚本后构建；特殊 Markdown、公式和图解按需构建。
- 格式检查限定本次修改文件，避免无关全文格式化。
- 全项目 `npm run check` 有既有 TypeScript 兼容与 Markdown 格式问题；应识别本次新增问题，不把旧问题误判为环境故障。
- 用户求理解时先解释原因，再给方法和示例；明确要求修改时直接完成并简要说明验证结果。
- 提交、推送及发布遵循用户当前授权，规则文件不额外授予外部操作权限。
