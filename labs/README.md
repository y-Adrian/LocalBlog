# labs — 博客配套代码实验

本目录 **不会** 被 Quartz 发布到站点（仅 `content/` 下的 Markdown 会建站）。

| 子目录 | 对应博文 |
|--------|----------|
| `c-cpp-mastery/` | 博文 `content/编程语言/C/C-C++ 主线实践验收.md` |

## 编译

在各 `stage*/` 下执行 `make`；产物已在 `.gitignore` 中忽略，**不要提交** 可执行文件、`.o`、`.dSYM`。

```bash
cd c-cpp-mastery/stage1-len-echo && make && make clean
```

## 与 Obsidian 的关系

- 笔记、开发日志写在 `content/`。
- 可运行示例放在 `labs/`，文中用相对路径或仓库路径引用即可。
