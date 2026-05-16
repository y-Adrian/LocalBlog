---
tags:
  - Linux
  - OTA
title: Mender 入门
description: 客户端、Artifact 与 A/B 协作概念
date: 2026/05/16
---

# Mender 入门

本文对应 [[成长路径/index|成长路径]] **OTA**：在已了解 [[linux/OTA/swupdate 入门|swupdate]] 后，了解 **Mender** 作为 **端到端 OTA 平台** 的另一种路径。

---

## 与 swupdate 的差异（概览）

| 项 | swupdate | Mender |
|----|----------|--------|
| 形态 | 组件 + 描述文件 | 客户端 +（可选）Mender Server |
| 编排 | 自行集成 | Server 管理批次、灰度 |
| 适合 | 深度定制固件 | 需要 **云管界面** 的团队 |

二者可都只学其一；A/B 分区模型相通，见 [[linux/OTA/A-B 分区与回滚策略]]。

---

## 核心概念

- **Mender Client**：设备上守护进程，拉取 **Artifact**。
- **Artifact**：含 rootfs / 应用更新 payload，**签名**。
- **Partition layout**：通常 **双 rootfs** + data。

---

## 基本流程

1. 构建 **rootfs 镜像** → 打包 Artifact。
2. Server 或 `mender-artifact` 工具发布。
3. Client 下载 → 写入非活动分区 → 重启 → **commit** 或 **rollback**。

---

## 实践建议

- [ ] 用 **Yocto meta-mender** 或 **Debian 包** 在 QEMU 试一轮。
- [ ] 对照本站 **A/B** 文画分区图，标 Mender 管理的 slot。

---

## 延伸阅读

- [[linux/学习路径/最小可启动工程指南]]
- [[linux/OTA/index]]
