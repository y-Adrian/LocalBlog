---
tags:
  - Linux
  - 网络
  - DPDK
title: Linux 内核网络栈与 DPDK 适用边界
description: socket 到驱动路径与旁路数据面的选型对照
date: 2026/05/16
---

# Linux 内核网络栈与 DPDK 适用边界

本文对应 [[成长路径/index|成长路径]] **高优先级**：能描述 **内核协议栈路径**，并说明何时 **旁路 DPDK**、何时保留内核栈。

---

## 内核路径（简化）

```text
应用 read/write
  → socket 层（struct socket）
  → 协议层（TCP/UDP/IP）
  → netfilter / routing
  → 邻居子系统 / ARP
  → qdisc
  → 驱动 ndo_start_xmit / NAPI 收包
```

收包常见：**硬中断 → 软中断 (NET_RX) → NAPI poll → 协议栈**。

调试入口：`ss`、`tcpdump`、`/proc/net/softnet_stat`、`dropwatch`（若可用）。

---

## DPDK 路径（简化）

```text
应用（poll 模式）
  → ethdev / PMD
  → mbuf / mempool
  → （可选）rte_flow 硬件分类
```

**不经过** 内核协议栈处理数据面报文；网卡由 **UIO/VFIO** 绑定给用户态。

---

## 对照表

| 维度 | 内核栈 | DPDK |
|------|--------|------|
| 编程模型 | socket，阻塞/ epoll | poll，busy loop |
| 协议 | 完整 TCP/IP | 常自建或仅 L2/L3 转发 |
| 生态 | iptables、路由、ss | rte_flow、自研 pipeline |
| 延迟抖动 | 中断 + 调度 | 绑核可压低抖动 |
| 开发成本 | 低 | 高（内存、并发、运维） |
| 典型吞吐 | 万兆以下常见足够 | 追求线速、小包 PPS |

---

## 何时优先内核栈

- 需要 **标准 TCP**、TLS、HTTP 等成熟栈。
- 流量 **中低 PPS**、连接数适中，**运维** 希望用现有工具。
- **管理口**、SSH、NTP、DNS 等 **控制面**。

---

## 何时考虑 DPDK

- **线速小包转发**、自定义 **L2/L3/L4** 处理。
- 需要 **与用户态零拷贝**、固定延迟预算。
- 硬件支持 **多队列 + RSS**，团队能维护 **绑核 / hugepage**。

混合架构常见：**管理口走内核**，**数据口 DPDK**；路由、BGP 等仍在内核或独立进程。

---

## 与站内教程的衔接

- DPDK 入门：[[网络与DPDK/教程/index]]
- 内存与 NUMA：[[网络与DPDK/内存子系统/DPDK 内存与子系统]]
- 绑核：[[linux/内核机制/进程调度与绑核]]

---

## 实践清单

- [ ] 用 `tcpdump -i eth0` 抓一条 TCP 连接，标出经过的层
- [ ] 用 `testpmd` 统计 PPS，对比同机内核 `iperf`（理解差异即可）
- [ ] 画一张目标产品的 **双口架构图**（管理 / 数据）

---

## 延伸阅读

- [[linux/内核机制/存储与IO子系统]]
- [[成长路径/index]]
