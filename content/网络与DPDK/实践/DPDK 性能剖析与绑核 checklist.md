---
tags:
  - DPDK
  - 性能
title: DPDK 性能剖析与绑核 checklist
description: perf、CPU 隔离、缓存行与 false sharing 检查项
date: 2026/05/16
---

# DPDK 性能剖析与绑核 checklist

本文对应 [[成长路径/index|成长路径]] **高优先级**：形成可重复的 **性能剖析闭环**。

---

## 绑核与环境

- [ ] `lcore` 掩码与 **`isolcpus`** 一致，管理面不在数据核
- [ ] **hugepage** 已挂载，`/dev/hugepages` 容量足够
- [ ] 网卡 **RSS 队列数** = worker 数（或明确映射表）
- [ ] **中断亲和** 指向非数据核：`/proc/irq/*/smp_affinity`

见 [[linux/内核机制/进程调度与绑核]]、[[网络与DPDK/教程/DPDK 教程 1：Hugepage、绑核、dpdk-devbind 与跑通 testpmd]]。

---

## NUMA

- [ ] mempool、ring、descriptor 与 **网卡 NUMA 节点** 同节点
- [ ] `numactl --hardware` 与 `rte_socket_id()` 对照

---

## perf 采样

```bash
perf record -C 2 -g -- sleep 30   # 对隔离核 2 采样
perf report
```

- [ ] 热点是否在 **PMD poll**、业务处理，而非内核
- [ ] 异常高的 **`rte_*` 锁** 或 memcpy → 查队列争用

---

## 缓存与 false sharing

- [ ] per-lcore 统计用 **`__rte_cache_aligned`**
- [ ] 多核写同一 cache line 的计数器 → 改为 **per-lcore 汇总**
- [ ] mbuf 私有数据避免跨核释放到错误 pool

---

## 功能回归

- [ ] PPS / 延迟 baseline 存档（包长 64/512/1518）
- [ ] 改代码后对比 **丢包计数**、`imissed`、`rx_nombuf`

---

## 延伸阅读

- [[网络与DPDK/教程/DPDK 教程 4：Offload、Flow、NUMA、IOVA 与性能剖析]]
- [[编程语言/C++/无锁编程]]
