---
tags:
  - DPDK
  - 并发
title: 多 worker 与 mempool 并发假设
description: 单生产者单消费者队列与 per-lcore 对象所有权
date: 2026/05/16
---

# 多 worker 与 mempool 并发假设

本文对应 [[成长路径/index|成长路径]] **高优先级**：明确 DPDK 数据面的 **并发模型**，并与 [[编程语言/C++/无锁编程]] 对照。

---

## 典型假设

| 对象 | 常见假设 |
|------|----------|
| **RX 队列** | 单 lcore **独占** 消费 |
| **TX 队列** | 单 lcore **独占** 发送 |
| **mempool** | 每核 **cache** + 默认非跨核 free |
| **rte_ring** | 创建时指定 **SP/SC** 或 **MP/MC** |

违反假设会导致 **偶发崩溃、统计错误、性能骤降**。

---

## mempool 与跨核释放

- **同核 alloc/free** 最便宜。
- 若 B 核释放 A 核分配的 mbuf：需 **mp-safe** 配置或 **通过 ring 归还** 到原核处理。
- 查阅 `rte_mempool` 与 PMD 文档的 **ops_index** 行为。

---

## rte_ring 标志

```c
ring = rte_ring_create(name, size, socket_id, RING_F_SP_ENQ | RING_F_SC_DEQ);
```

| 标志 | 含义 |
|------|------|
| SP/SC | 单生产者单消费者，最快 |
| MP/MC | 多生产者多消费者，需 CAS |

---

## 与 C++ 无锁对照

| DPDK | 通用无锁 |
|------|----------|
| per-lcore 变量 | thread-local / 每核数组 |
| rte_ring | SPSC/MPSC 队列 |
| memory order 较少暴露 | `atomic` + memory_order |

内核侧勿照搬 DPDK 假设到 **spinlock/RCU** 混用场景。

---

## 设计检查清单

- [ ] 画 **数据流图**：包从 port → worker → port，标出核号
- [ ] 每个 mbuf **生命周期** 只被一个 lcore 写
- [ ] 统计计数 **per-lcore 数组**，主核定期汇总

---

## 延伸阅读

- [[网络与DPDK/教程/DPDK 教程 3：多队列 + RSS + 多 worker 的最小转发 or Echo]]
- [[网络与DPDK/实践/最小数据面项目设计]]
