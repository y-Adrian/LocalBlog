---
tags:
  - 调试
title: coredump 分析基础
description: ulimit、gdb 分析崩溃栈与嵌入式限制
date: 2026/05/16
---

# coredump 分析基础

本文对应 [[成长路径/index|成长路径]] **系统调试 · 中优先级**。

---

## 启用

```bash
ulimit -c unlimited
echo /tmp/core.%e.%p | sudo tee /proc/sys/kernel/core_pattern
```

嵌入式可改为 **固定路径** 并限制 **分区大小**。

---

## 分析

```bash
gdb ./app /tmp/core.app.1234
(gdb) bt full
(gdb) info registers
```

需 **与运行二进制一致的符号**；strip 后保留 **debug 包**。

---

## 嵌入式限制

- 存储小：只保留 **最后一次** core 或 **压缩上传**。
- 内存紧张：core 可能不全，优先 **addr2line + 日志栈**。

见 [[系统调试/反汇编在嵌入式问题定位中的应用：环境、工具与可读性]]。

---

## 延伸阅读

- [[系统调试/排障 SOP：日志、perf 与反汇编]]
