---
tags:
  - DPDK
  - 网络
title: VPP 与 OVS 定位速览
description: 不必深钻除非工作涉及
date: 2026/05/16
---

# VPP 与 OVS 定位速览

本文对应 [[成长路径/index|成长路径]] **低优先级**：知道 **VPP / OVS** 与 **自研 DPDK** 的分工即可。

---

## VPP（Vector Packet Processing）

- **FD.io** 生态，图节点 **向量化** 处理包。
- 适合 **路由器 / vSwitch** 类产品化方案，插件丰富。
- 与 **DPDK** 关系：底层常用 DPDK 做 IO。

---

## Open vSwitch (OVS)

- **虚拟交换机**，**OpenFlow / OVSDB**。
- **云 / SDN** 场景多；数据面可走 **内核** 或 **DPDK offload**。

---

## 与本站 DPDK 教程

| 目标 | 路径 |
|------|------|
| 自己写转发 / echo | [[网络与DPDK/教程/index]] |
| 用成熟虚拟交换 | 评估 OVS |
| 用向量图框架 | 评估 VPP |

---

## 延伸阅读

- [[linux/内核机制/Linux 内核网络栈与 DPDK 适用边界]]
