---
date: 2026/05/21
title: 分布式共识算法
description: Paxos、Raft、Quorum 与工程实现（etcd 等）学习索引
tags:
  - 分布式
  - 共识
  - Raft
  - Paxos
---

# 分布式共识算法

**共识（consensus）** 要解决：在可能宕机、丢包、乱序的网络里，多个节点对 **同一条有序日志**（或同一配置值）达成 **一致且可恢复** 的结果。与 [[网络与DPDK/实践/RPC 技术与分层详解]] 里的 **服务发现（etcd、Consul）**、[[数据库/PostgreSQL 中的物理复制与逻辑复制：机制、差异与选型|PostgreSQL 流复制]] 相关，但层次不同——见 [[分布式共识算法概览]]。

---

## 1. 读完本目录应能回答什么

- **CAP / 一致性级别**：强一致、最终一致各适合什么场景。  
- **Paxos 与 Raft**：各解决什么问题、工程上为何常选 Raft。  
- **复制日志 vs 产品复制**：共识模块的 log 与 PG WAL 流复制如何区分、如何配合。

---

## 2. 推荐阅读顺序

```mermaid
flowchart LR
  O[概览 CAP Quorum]
  P[Paxos 直觉]
  R[Raft 工程]
  E[etcd 与边界]
  O --> P --> R --> E
```

| # | 文档 | 状态 |
|---|------|------|
| 0 | [[分布式共识算法概览]] | ✅ |
| 1 | [[Paxos 与 Multi-Paxos 速览]] | ✅ |
| 2 | [[Raft 原理与工程实现]] | ✅ |
| 3 | [[共识与复制边界]]（对照 PostgreSQL / WAL） | ✅ |
| 4 | [[etcd 与 Raft 案例]]（控制面元数据） | ✅ |

本站主线是 **嵌入式 Linux / 驱动 / DPDK**：共识专题读到 **会用 etcd、分清与 DB 复制边界** 即可，**不**把 toy Raft 当作待补主线。

---

## 3. 与 RPC / 数据库的交叉链接

| 你想… | 从这里开始 |
|-------|------------|
| RPC 分层、发现、负载均衡 | [[网络与DPDK/实践/RPC 技术与分层详解]] |
| 库级物理/逻辑复制 | [[数据库/index]] |
| 共识动机与术语 | [[分布式共识算法概览]] |
| 总目录 | [[分布式系统/index]] |

---

## 4. 实践与源码

| 方向 | 说明 |
|------|------|
| **etcd / raft** | 读 `etcdserver` 与 `raft` 库日志状态机 → [[etcd 与 Raft 案例]] |
| **嵌入式** | 多数场景 **消费** 共识服务，而非自研；选型见概览 §5 |

可视化辅助理解：[Raft 动画](https://raft.github.io)、[The Secret Lives of Data](https://thesecretlivesofdata.com/raft/)。

---

*新增专题先写在本目录，再在 [[成长路径/index]] §11.5 勾选并回链。*
