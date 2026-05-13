# 1 Git 深度使用教程（面向高级开发者）

本文面向已掌握 `clone / add / commit / push / pull / branch / merge` 的读者，聚焦**高阶能力、日常高频技巧、排障与团队协作**。命令以 Git 2.40+ 为参考；若版本较旧，个别子命令或行为可能略有差异。

---

## 1.1 一、心智模型：先对齐「Git 在算什么」

- **提交是有向无环图（DAG）**：分支、合并、变基都是在改指针与改写历史边。
- **三棵树**：工作区（working tree）→ 暂存区（index）→ 当前提交（HEAD）。多数「搞不懂暂存」的问题，回到这三棵树对齐语义即可。
- **引用（refs）**：`refs/heads/*`、`refs/remotes/*`、`HEAD`、`HEAD~3`、`main@{2}` 等；理解引用是读 `reflog`、恢复丢失提交的前提。
- **可达性（reachability）**：`A..B`、`A...B` 这类范围与 `log`/`diff` 的默认行为都建立在「从某提交可达」上。

---

## 1.2 二、配置：把 Git 调成「长期生产力工具」

### 1.2.1 必会的基础配置

```ini
# ~/.gitconfig 片段示例
[user]
    name = Your Name
    email = you@example.com

[init]
    defaultBranch = main

[push]
    default = simple
    autoSetupRemote = true

[fetch]
    prune = true

[rerere]
    enabled = true

[column]
    ui = auto

[branch]
    sort = -committerdate
```

- **`fetch.prune`**：远端已删分支本地同步清理，避免「幽灵分支」干扰。
- **`push.autoSetupRemote`**：首次 `push -u` 后减少重复指定 upstream。
- **`rerere.enabled`**：记录冲突解决，重复冲突时自动复用（见后文）。

### 1.2.2 条件包含（多身份 / 多公司）

```ini
# ~/.gitconfig
[includeIf "gitdir:~/work/acme/"]
    path = ~/.gitconfig-acme
[includeIf "gitdir:~/work/personal/"]
    path = ~/.gitconfig-personal
```

按目录自动切换 `user.email`、`core.sshCommand` 等，比每个仓库手改更可靠。

### 1.2.3 实用别名（按需裁剪）

```ini
[alias]
    lg = log --graph --pretty=format:'%C(auto)%h%d %s %C(bold blue)<%an>%Creset' --abbrev-commit --date=relative
    recent = "!git for-each-ref --sort=-committerdate --format='%(committerdate:short) %(refname:short)' refs/heads/ | head"
    undo = reset --soft HEAD~1
    amend = commit --amend --no-edit
    wipe = "!git reset --hard && git clean -fd"
```

**注意**：`wipe` 类别名极危险，仅适合个人沙箱仓库。

---

## 1.3 三、差异与历史：精读代码演进的工具箱

### 1.3.1 `git diff` 高阶

```bash
# 工作区 vs 暂存区
git diff

# 暂存区 vs HEAD
git diff --cached

# 任意两点（常用于「main 上我多了啥」）
git diff main...HEAD

# 仅看某路径
git diff main -- path/to/file

# 词级 diff（长行改动更清晰）
git diff --word-diff

# 忽略空白
git diff -w
```

**三点与两点**：`A B` 是两参数比较；`A...B`（三点）在 `merge-base` 语境下常用于「特性分支相对分叉点的变更」，与 PR 默认 diff 直觉一致。

### 1.3.2 `git log`：过滤与取证

```bash
# 某文件的演进（含改名跟踪）
git log --follow -p -- path/to/file

# pickaxe：补丁层面搜字符串出现/消失
git log -S"foo()" --oneline -- path/

# 正则版本（版本依赖）
git log -G"regex_here" --oneline

# 谁在一行上改过（配合 -L）
git log -L :funcName:path/to/file

# 仅合并提交
git log --merges

# 第一父提交链（主线历史，适合「看发布线」）
git log --first-parent main
```

### 1.3.3 `git blame` 与忽略无关提交

```bash
git blame -w -C -C path/to/file
git blame --ignore-rev <mass-format-rev> path/to/file
```

`-C` 检测行移动来源；`-w` 忽略空白；`--ignore-rev` 适合「大规模格式化」噪音（需配合 `.git-blame-ignore-revs`）。

---

## 1.4 四、暂存与提交粒度：`git add -p` 与拆提交

### 1.4.1 交互式暂存

```bash
git add -p
# 或对单文件
git add -p -- path/to/file
```

子命令：`s`plit（再拆）、`e`dit（手动编辑 hunk）、`q`uit。高级开发者应能**稳定拆出原子提交**，便于 bisect、revert、code review。

### 1.4.2 intent-to-add（空文件 / 新文件分阶段）

```bash
git add -N path/to/newfile
```

新文件进入索引但内容仍属「未暂存」，适合配合 `-p` 逐步添加。

### 1.4.3 修改上一次提交而不改树（仅改 message）

```bash
git commit --amend
```

### 1.4.4 把「已提交」拆成多个提交（未 push 或团队允许改写）

常用路径：`git reset --soft HEAD~N` 后重新 `add -p` + 多次 `commit`，或 `git rebase -i` 标记 `edit` 后 `reset`/`commit`。

---

## 1.5 五、stash：不止「临时存一下」

```bash
# 默认 stash 含暂存与工作区（行为随版本略有选项差异，以 --help 为准）
git stash push -m "wip: experiment tls" -- path/to/dir

# 包含未跟踪文件
git stash -u

# 保留索引（已 add 的不动）
git stash --keep-index

# 列表与显示
git stash list
git stash show -p stash@{0}

# 应用并删除 / 仅应用
git stash pop
git stash apply stash@{1}

# 从 stash 建分支（冲突时特别好用）
git stash branch recover-from-stash stash@{0}
```

**原则**：长期 WIP 更推荐**分支或 worktree**；`stash` 适合短生命周期、易忘的上下文切换。

---

## 1.6 六、rebase：可维护历史的核心技能

### 1.6.1 交互式 rebase

```bash
git rebase -i HEAD~5
```

常用指令：`pick` / `reword` / `squash` / `fixup` / `drop` / `exec`。

### 1.6.2 autosquash：与 `--fixup` / `--squash` 配合

```bash
git commit --fixup=abc1234
git rebase -i --autosquash abc1234^
```

把「修正提交」自动排到目标提交之后并标记为 fixup，减少手工排序。

### 1.6.3 `rebase --onto`：从分叉中间「剪枝」

典型场景：在错误的基底上拉了一条分支，需要挪到新的 `main`。

```bash
git rebase --onto <newbase> <oldbase> <branch>
```

理解方式：取出「在 oldbase 之后、branch 可达」的提交，逐个接到 `newbase` 上。

### 1.6.4 变基中的冲突与 ours/theirs

在 **rebase** 过程中：

- `--ours` 通常指**正在变基上去的分支（upstream）**
- `--theirs` 通常指**被重放的提交**

易混淆，**以 `git status` 提示为准**，不要盲目背口诀。

### 1.6.5 `rerere`（reuse recorded resolution）

```bash
git config --global rerere.enabled true
```

同一冲突模式在多次 rebase/merge 中反复出现时，能显著减少机械劳动。团队规范化冲突解决后收益更大。

---

## 1.7 七、merge：策略与何时用 `--no-ff`

```bash
git merge --no-ff feature/x -m "Merge feature x"
```

- **`--no-ff`**：保留合并节点，便于在 `log --first-parent` 上看「功能粒度」。
- **默认 fast-forward**：历史线性，但丢失「这是一次功能合并」的元信息。

**选择**：开源/大团队常混合；内部若强依赖 release 分支审计，可适当保留 merge 节点。

---

## 1.8 八、cherry-pick / revert：精准搬运与安全回滚

### 1.8.1 cherry-pick 范围

```bash
git cherry-pick A^..B
```

语义为「不包含 A 本身、包含 B」的常见写法；实际操作前用 `git log --oneline A..B` 核对集合。

### 1.8.2 revert 合并提交

合并提交的 revert 需要指定 **mainline parent**：

```bash
git revert -m 1 <merge_commit_sha>
```

`-m 1` 通常表示保留第一父提交所在主线（以团队约定为准）。

---

## 1.9 九、bisect：二分定位缺陷引入提交

```bash
git bisect start
git bisect bad                 # 当前已知坏
git bisect good v1.2.3         # 已知好
# Git 检出中间提交：构建/跑测试后
git bisect good    # 或 bad
# ...
git bisect reset
```

可脚本化：

```bash
git bisect run ./scripts/test.sh
```

高级价值：与 CI、单测、模糊测试结合，把「几周前的回归」收敛到单次提交。

---

## 1.10 十、reflog：本地「安全网」

```bash
git reflog
git reflog show main
```

典型恢复：

```bash
git branch recovered abc1234
# 或
git reset --hard abc1234
```

**局限**：reflog 是**本地**的；未推送的丢失提交若 reflog 也被 GC（默认约 90 天），可能不可恢复。重要工作：**及时 push 到远端（含私有分支）**。

---

## 1.11 十一、worktree：并行多检出（强烈推荐）

```bash
git worktree add ../repo-hotfix hotfix/123
git worktree list
git worktree remove ../repo-hotfix
```

适用：紧急 hotfix 与长期 feature 并行、避免 `stash` 来回切、减少子模块/依赖重装成本（视项目而定）。

**注意**：同一分支不要在两个 worktree 同时检出（Git 会阻止）；用新分支名承载并行工作。

---

## 1.12 十二、子模块与子树（知道边界即可）

### 1.12.1 submodule

```bash
git submodule update --init --recursive
git -C path/to/sub pull
```

痛点： detached HEAD、远端 URL 变更、CI 缓存。高级用法包括 `submodule foreach`、在 CI 里固定 commit。

### 1.12.2 subtree（简化版「_vendor 内嵌」）

适合把上游库以目录形式纳入 monorepo；具体命令较长，建议单独建「子树 playbook」文档以免误操作。

---

## 1.13 十三、稀疏检出与部分克隆（大仓库）

### 1.13.1 sparse-checkout

```bash
git sparse-checkout init --cone
git sparse-checkout set apps/web packages/ui
```

单仓巨大时，减少 I/O 与 IDE 索引压力。

### 1.13.2 partial clone / blob filter

```bash
git clone --filter=blob:none <url>
```

配合 `git sparse-checkout` 在超大型 monorepo（如巨型 C++/Android）中很常见。

---

## 1.14 十四、bundle：离线/弱网搬运对象库

```bash
git bundle create repo.bundle --all
git clone repo.bundle dir
```

适合跨隔离网络、展会现场、无 SSH 的跳板环境。

---

## 1.15 十五、历史重写与现代替代方案

### 1.15.1 `git filter-repo`（推荐）

取代易踩坑的 `filter-branch`，用于：

- 全局移除密钥/大文件
- 目录拆仓

安装通常通过系统包管理器或 `pip install git-filter-repo`。使用前务必备份裸克隆。

### 1.15.2 `git replace`（高级、少见）

用替换对象「嫁接历史」，用于奇异迁移；团队内需强文档化，否则后人难维护。

---

## 1.16 十六、签名与供应链：提交与标签可信

```bash
# SSH 签名（Git 新版本常见）
git config gpg.format ssh
git config user.signingkey ~/.ssh/id_ed25519.pub
git commit -S -m "signed"

git tag -s v1.4.0 -m "release"
```

配合策略：CI 校验签名、保护分支要求 signed commits（平台侧设置）。

---

## 1.17 十七、远程与推送：上游、跟踪与强制推送礼仪

```bash
git branch -vv
git push -u origin feature/x

# 安全的 force-with-lease（避免覆盖他人新推送）
git push --force-with-lease
```

`--force-with-lease` 依赖「以为的远端引用仍是最新」这一假设，是协作场景下的默认选择。

---

## 1.18 十八、`git grep` 与 pathspec：仓库内高速搜索

```bash
git grep -n "TODO\\(" HEAD
git grep --cached pattern
```

比通用 `rg` 在「只搜 Git 跟踪文件、按提交搜」场景更直接；pathspec 可限制目录与模式。

---

## 1.19 十九、底层一瞥：when `git cat-file` saves the day

```bash
git rev-parse HEAD
git cat-file -p HEAD^{tree}
git ls-tree -r HEAD -- path
```

用于理解对象类型、写自动化脚本、排查奇怪引用。

---

## 1.20 二十、团队协作「政治与工程」清单

1. **默认不 force push 共享分支**；需要时用 `--force-with-lease` 并沟通。
2. **公共分支上的历史重写**走平台「rebase merge」策略或团队规范，避免各本地分叉失控。
3. **大文件与密钥**：`.gitattributes` LFS、pre-commit hook、secret scanner；出事用 `filter-repo` 修历史并轮换密钥。
4. **合并冲突文化**：约定「谁解决、何时拉 main、是否 squash merge」，比单纯争论 merge/rebase 更有意义。
5. **提交信息**：Conventional Commits 等规范利于自动生成 changelog、风险控制。

---

## 1.21 二十一、推荐阅读与练习路径

1. 官方书 [Pro Git](https://git-scm.com/book/zh/v2) 第 7–10 章（重写历史、内部原理选读）。
2. 本地练习：`git clone` 一个沙箱仓库，刻意制造冲突、丢失 `HEAD`、`rebase --onto` 迁移分支，用 `reflog` 恢复。
3. 把 **worktree + fixup/autosquash + -p 拆提交** 变成肌肉记忆，收益高于记忆冷门 plumbing 命令。

---

## 1.22 二十二、速查表（高阶日常）

| 场景 | 命令/思路 |
|------|-----------|
| PR 前整理提交 | `git rebase -i` + `fixup`/`squash` |
| 误改未提交 | `git restore --staged` / `git restore .` |
| 找引入 bug 的提交 | `git bisect` + 脚本 |
| 临时切走当前修改 | `git stash push -- 路径` 或 `worktree` |
| 远端删分支本地残留 | `fetch.prune` 或 `git remote prune origin` |
| 安全覆盖远端 feature | `git push --force-with-lease` |
| 大仓克隆 | `--filter=blob:none` + `sparse-checkout` |
| 恢复「以为丢了」的提交 | `git reflog` → `branch`/`reset` |

---

文档版本：随 Git 演进请以 `git help <command>` 为准。若你希望补充「公司内部 GitLab/GitHub Flow 对照表」或「monorepo 专属工作流」，可在此基础上扩展第二节与第二十节。
