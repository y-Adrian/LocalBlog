---
tags:
  - DPDK
  - RDMA
title: RDMA 适用场景速览
description: 特定行业低延迟存储与网络
date: 2026/05/16
---

# RDMA 适用场景速览

本文对应 [[成长路径/index|成长路径]] **低优先级**：知道 **RDMA** 何时出现，与 **DPDK 以太网转发** 的区别。

---

## 是什么

**Remote Direct Memory Access**：网卡 **直接读写** 对端内存，绕过对方 CPU 大量参与，延迟低、CPU 占用小。

常见实现：**InfiniBand**、**RoCEv2**（以太网上的 RDMA）、**iWARP**。

---

## 典型场景

- **分布式存储**（Ceph、NVMe-oF）
- **HPC** 集群 MPI
- **金融** 共置低延迟（与专线、FPGA 等组合）

---

## 与 DPDK

| 项 | RDMA | DPDK 以太网 |
|----|------|-------------|
| API | verbs（`ibv_*`）/ 厂商 SDK | `rte_eth` |
| 编程模型 | 队列对 QP、完成队列 CQ | mbuf poll |
| 主线重合度 | 低 | 本站主线 |

除非岗位明确，**不必** 与 DPDK 教程并行深钻。

---

## 延伸阅读

- [[网络与DPDK/内存子系统/DPDK 内存与子系统]]
