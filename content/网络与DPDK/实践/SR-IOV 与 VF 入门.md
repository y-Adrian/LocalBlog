---
tags:
  - DPDK
  - 虚拟化
title: SR-IOV 与 VF 入门
description: 云与虚拟化场景下的硬件虚拟化网卡
date: 2026/05/16
---

# SR-IOV 与 VF 入门

本文对应 [[成长路径/index|成长路径]] **中优先级**：在 **云主机 / NFV** 场景中理解 **SR-IOV** 如何把物理网卡 **切分给虚拟机**，以及与 **DPDK** 的关系。

---

## 概念

| 术语 | 含义 |
|------|------|
| **PF（Physical Function）** | 物理网卡完整功能，宿主机可见 |
| **VF（Virtual Function）** | 从 PF 切出的轻量功能，可 **直通** 给 VM |
| **SR-IOV** | PCIe 标准，硬件实现多 VF |

VM 获得 VF 后，性能接近 **裸金属数据面**，绕过软件 vSwitch 的部分开销。

---

## 与 DPDK

- Guest 内可对 **VF** 做 `dpdk-devbind`，与物理机用法类似。
- 宿主机常保留 **PF** 做管理，**VF** 分给业务 VM。
- **NUMA**：VF 与 CPU 节点对齐仍重要，见 [[网络与DPDK/实践/DPDK 性能剖析与绑核 checklist]]。

---

## 与内核 vSwitch

| 模式 | 特点 |
|------|------|
| **virtio-net** | 通用、迁移方便，性能较低 |
| **SR-IOV VF 直通** | 高性能，迁移/编排更复杂 |
| **OVS-DPDK + VF** | 混合方案，见 [[网络与DPDK/实践/VPP 与 OVS 定位速览]] |

---

## 运维注意

- BIOS 开启 **VT-d / IOMMU**，内核 **`intel_iommu=on`** 等。
- VF 数量受 **网卡硬件** 限制；超分需规划。
- **MAC/VLAN** 由云管或 SDN 分配。

---

## 延伸阅读

- [[linux/内核机制/Linux 内核网络栈与 DPDK 适用边界]]
- [[网络与DPDK/实践/与内核网络栈共存]]
