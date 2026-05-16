---
title: 网络与 DPDK
description: 用户态高性能网络与 DPDK 学习笔记
---

# 网络与 DPDK

DPDK 相关文档按 **教程（循序渐进）** 与 **专题（内存子系统）** 拆分。

## 子目录

| 目录 | 说明 |
|------|------|
| [[网络与DPDK/教程/index|教程]] | 四步学习路径：环境 → 数据路径 → 多队列 → 性能 |
| [[网络与DPDK/内存子系统/index|内存子系统]] | EAL、大页、mempool、mbuf、IOVA 等深度说明 |
| [[网络与DPDK/实践/index|实践]] | 小项目设计、性能 checklist、并发模型 |

## 与 Linux 笔记的关系

- 内核网络栈与存储：[[linux/内核机制/存储与IO子系统]]
- NUMA / 绑核：与 [[linux/内核机制/深入了解上下文切换]]、cgroup 等可对照阅读
