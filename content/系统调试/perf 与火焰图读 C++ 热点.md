---
tags:
  - 调试
  - perf
  - C++
title: perf 与火焰图读 C++ 热点
description: 采样、折叠栈与定位 C++ 符号
date: 2026/05/16
---

# perf 与火焰图读 C++ 热点

本文对应 [[成长路径/index|成长路径]] **C++ / 系统调试**：用 **perf + 火焰图** 找用户态 **CPU 热点**。

---

## 采样

```bash
perf record -g --call-graph dwarf -F 99 ./app
perf script > out.perf
```

保留 **调试符号**：`-g` 编译，或安装 `app.debug` 分离符号。

---

## 火焰图（Brendan Gregg 工具）

```bash
git clone https://github.com/brendangregg/FlameGraph.git
perf script | ./FlameGraph/stackcollapse-perf.pl | ./FlameGraph/flamegraph.pl > fg.svg
```

横条越宽 **累计 CPU 越多**；纵轴为 **调用栈深度**。

---

## C++ 注意

- 模板栈可能 **极深**，关注 **业务函数名**。
- LTO 后符号可能合并，对比 **优化前后** 用同一工具链。

---

## 与 DPDK

数据面线程需 **对指定 CPU** 采样：

```bash
perf record -C 2 -g -- sleep 30
```

见 [[网络与DPDK/实践/DPDK 性能剖析与绑核 checklist]]。

---

## 延伸阅读

- [[系统调试/排障工具链一张图]]
- [[系统调试/排障 SOP：日志、perf 与反汇编]]
