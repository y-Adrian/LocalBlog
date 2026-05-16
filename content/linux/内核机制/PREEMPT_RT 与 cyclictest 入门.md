---
tags:
  - Linux
  - 实时
title: PREEMPT_RT 与 cyclictest 入门
description: 实时补丁、最坏延迟测量（选做）
date: 2026/05/16
---

# PREEMPT_RT 与 cyclictest 入门

本文对应 [[成长路径/index|成长路径]] **选做**：评估 **内核实时性** 是否满足工控/采集需求。

---

## PREEMPT_RT

- 将大量 spinlock 改为 **可抢占**，降低 **最大延迟**。
- 需打 **RT 补丁** 或使用发行版 **PREEMPT_RT** 内核。

---

## cyclictest

```bash
cyclictest -p 99 -t 1 -n -i 1000 -l 100000
```

关注 **Max** 延迟（us）。绑核与 **isolcpus** 见 [[linux/内核机制/进程调度与绑核]]。

---

## 注意

- RT 内核 **维护成本** 高。
- 与 **DPDK busy poll** 是不同路线，可组合（管理面 RT + 数据面 DPDK）。

---

## 延伸阅读

- [[系统调试/内核卡死与 hung task 入门]]
