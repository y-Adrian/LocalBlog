---
tags:
  - Linux
  - 嵌入式
title: Shell、Makefile、Git 命令行基础
description: 嵌入式 Linux 学习路径第一阶段：命令行编辑、编译与版本追溯
---

# 1 Shell、Makefile、Git 命令行基础

本文是 **嵌入式 Linux 学习路径** 的第一阶段：在图形 IDE 之外，建立 **Shell 环境、Makefile 构建、Git 版本管理** 的熟练度。完成后你应能在 **SSH/串口终端** 中独立完成：编辑源码、增量编译、查看 diff、回滚错误提交，并把同一套习惯带到 **Buildroot/Yocto/内核树** 中。

---

## 1.1 学习目标

- 熟练使用 **Bash** 进行路径、重定向、管道、环境变量与脚本基础。
- 能编写 **可维护的 Makefile**（变量、模式规则、依赖、多目标）。
- 掌握 **Git** 日常：clone、branch、commit、diff、log、stash、revert；理解 **与 BSP/内核协作** 时的分支策略。
- 建立 **「一切可脚本化、可复现」** 的工程习惯。

---

## 1.2 第一部分：Shell（Bash）

### 1.2.1 为何嵌入式必须强 Shell

- 目标板常只有 **串口 + BusyBox ash/bash**；现场排障没有 IDE。
- **Buildroot/Yocto/内核** 构建入口都是 Makefile + shell 脚本。
- **自动化**（烧录、打包、跑测试）最终都落在 shell 或调用 shell 的 CI 上。

### 1.2.2 核心技能清单

**导航与文件**

```bash
pwd; cd; ls -la; find . -name '*.c'; tree -L 2
cp -a; mv; rm -i; mkdir -p; ln -s
```

**查看与编辑**

```bash
less; head; tail -f /var/log/messages   # 目标机上常见
grep -RIn "pattern" --include='*.h'
vim 或 nano：至少一种要熟练到改配置、搜符号
```

**重定向与管道**

```bash
cmd > out 2>&1; cmd | tee log.txt
cmd1 | cmd2 | cmd3
```

**环境变量**

```bash
export PATH="$PATH:/opt/toolchain/bin"
export CROSS_COMPILE=aarch64-linux-gnu-
echo "$VAR"; env | grep CROSS
```

**脚本基础（`set -euo pipefail` 推荐）**

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
make -j"$(nproc)"
```

### 1.2.3 实践练习

- 写脚本：遍历 `src/` 下所有 `.c`，统计行数并输出 Top 5 文件。
- 用 `find` + `xargs` 或 `while read` 批量 `grep` 某 API 用法。
- 在 **串口终端**（或 `minicom`/`picocom`）里完成同样操作，适应无鼠标环境。

### 1.2.4 常见坑

- **路径含空格**未加引号：`"$path"`。
- **Windows 换行 CRLF** 导致 `^M`：用 `dos2unix` 或 `git config core.autocrlf`。
- **BusyBox** 与 GNU coreutils 选项差异：脚本里用 `busybox ls --help` 核对。

---

## 1.3 第二部分：Makefile

### 1.3.1 为何不是只学 CMake

- **Linux 内核、U-Boot、Buildroot** 原生是 **Kbuild/Makefile**；读不懂 Makefile 无法改 defconfig、加模块、加 package。
- CMake/Meson 常出现在 **应用层**；底层仍常 **调用 make** 或生成 Ninja 再构建。

### 1.3.2 最小可维护 Makefile 结构

```makefile
# 工具链可由环境传入
CC      ?= gcc
CFLAGS  ?= -Wall -Wextra -O2 -g
LDFLAGS ?=
LDLIBS  ?=

SRCS := main.c foo.c
OBJS := $(SRCS:.c=.o)
TARGET := app

.PHONY: all clean

all: $(TARGET)

$(TARGET): $(OBJS)
	$(CC) $(LDFLAGS) -o $@ $^ $(LDLIBS)

%.o: %.c
	$(CC) $(CFLAGS) -c -o $@ $<

clean:
	rm -f $(OBJS) $(TARGET)
```

### 1.3.3 必须掌握的概念

| 概念 | 说明 |
|------|------|
| **变量** | `:=` 立即展开 vs `=` 递归展开 |
| **自动变量** | `$@` 目标；`$<` 首依赖；`$^` 全部依赖 |
| **模式规则** | `%.o: %.c` |
| **伪目标** | `.PHONY: clean all` |
| **条件** | `ifeq ($(ARCH),arm)` … `endif` |
| **include** | `-include config.mk` 引入交叉编译配置 |

### 1.3.4 依赖跟踪（避免改头文件不重建）

```makefile
DEPS := $(OBJS:.o=.d)
-include $(DEPS)

%.o: %.c
	$(CC) $(CFLAGS) -MMD -MP -c -o $@ $<
```

### 1.3.5 与交叉编译衔接

```makefile
CROSS_COMPILE ?= aarch64-linux-gnu-
CC := $(CROSS_COMPILE)gcc
```

### 1.3.6 实践练习

- 把单文件 hello 扩展为多文件 + 静态库 `libfoo.a`。
- 增加 `make install DESTDIR=/tmp/root` 模拟安装到 rootfs。
- 阅读 **内核** `Documentation/kbuild/makefiles.rst` 前几节，找到 `obj-m` 与 `obj-y` 的含义。

### 1.3.7 常见坑

- **Tab 与空格**：recipe 行必须以 **Tab** 开头。
- **并行 make -j** 下缺少依赖导致偶发链接错误：加 `-MMD` 或显式依赖。
- 在源码树里 **手写 install 到 /**：嵌入式应 **DESTDIR** 指向 staging/rootfs。

---

## 1.4 第三部分：Git

### 1.4.1 嵌入式场景里 Git 解决什么

- **BSP/内核/应用** 多仓库协作；**可追溯**「哪次提交引入了 boot 失败」。
- **Yocto layer**、**Buildroot package 补丁** 都以 patch/commit 形式存在。
- 与 **厂商 tarball** 并存时，用 Git 管理 **本地 delta** 比改乱目录可维护。

### 1.4.2 日常工作流

```bash
git clone --depth=1 <url>          # 浅克隆大仓库时可加速
git status; git diff; git diff --staged
git add -p                         # 按块暂存，养成好习惯
git commit -m "subject: body"
git log --oneline -20
git show <commit>
git branch -vv; git switch -c feature/foo
git merge --no-ff; git rebase -i   # 团队规范择一，勿混用
git stash; git stash pop
git revert <commit>                # 已推送历史用 revert 而非改历史
```

### 1.4.3 与补丁协作

```bash
git format-patch -1 HEAD
git am *.patch
git apply --check 0001-xxx.patch
```

### 1.4.4 分支策略（小团队实用）

- **`main`**：可发布/可烧录镜像对应提交。
- **`develop`** 或 **按板卡分支** `board/xxx`：集成中改动。
- **vendor 基线**：打 tag `vendor-bsp-v1.0`，本地改动在其上 commit，便于 **rebase 厂商更新**。

### 1.4.5 实践练习

- 初始化仓库，至少 **10 次有意义 commit**（不要一次提交整个项目）。
- 故意引入 bug commit，用 **`git bisect`** 定位（配合 `make test` 脚本）。
- 从内核邮件列表下载 patch，用 **`git am`** 应用并解决冲突。

### 1.4.6 常见坑

- **提交大二进制**（镜像、.o）：用 **`.gitignore`** + **Git LFS** 或制品库。
- **子模块** `submodule` 未更新导致同事编不过：`git submodule update --init --recursive`。
- 在 **内核树** 里 `git clean -fdx` 会删 build 产物也可能误删未跟踪配置——先 `git status`。

---

## 1.5 阶段验收（自检）

- [ ] 不用 IDE 完成：改代码 → `make` → 运行 → `git diff` → `commit`。
- [ ] 能解释 Makefile 中 `$@` `$<` 含义，并加 `-MMD` 依赖。
- [ ] 能 **`git revert`** 一次错误合并并推送到远程（若用远程）。
- [ ] 能写 **20 行以内** Bash 脚本带 `set -euo pipefail` 调用交叉编译器。

---

## 1.6 下一阶段衔接

- **体系结构入门**：理解 MMU/中断后，读内核 panic 与 `/proc/cpuinfo` 才有锚点。
- **交叉编译**：Makefile 里 `CROSS_COMPILE` 将变为 **sysroot + toolchain 文件**。

---

## 1.7 参考

- *Advanced Bash-Scripting Guide*（在线）
- GNU **Make Manual**
- Pro Git（https://git-scm.com/book）

---

*本阶段刻意不展开 IDE 快捷键；目标是终端与脚本可迁移到任何 BSP 环境。*
