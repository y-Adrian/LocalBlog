---
tags:
  - 调试
title: ASan 与 Valgrind 桌面验证
description: 在主机侧发现内存错误再移植到嵌入式
date: 2026/05/16
---

# ASan 与 Valgrind 桌面验证

本文对应 [[成长路径/index|成长路径]] **系统调试 · 中优先级**：算法与协议逻辑在 **x86 主机** 上先扫 **内存错误**，再交叉编译上板。

---

## AddressSanitizer (ASan)

```bash
gcc -fsanitize=address -g -O1 -o app app.c
./app
```

检测 **heap/stack/global** 越界、use-after-free。ARM 目标也可开 ASan（需工具链支持，**体积与慢速** 明显）。

---

## Valgrind

```bash
valgrind --leak-check=full ./app
```

**仅模拟 x86** 等主机架构；交叉编译的 ARM 二进制需 **qemu-user** 或直接在板子上用 **valgrind**（若可用）。

---

## 策略

| 阶段 | 做法 |
|------|------|
| 开发 | 主机 ASan 跑单元测试 |
| 集成 | 板上 smoke test + 日志 |
| 驱动 | 内核 KASAN（开发内核） |

---

## 延伸阅读

- [[工程基础/嵌入式代码评审清单]]
