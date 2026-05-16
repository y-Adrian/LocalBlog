---
tags:
  - Linux
  - 安全
title: TrustZone 与安全启动概念
description: 安全世界、签名链与 BSP 责任边界
date: 2026/05/16
---

# TrustZone 与安全启动概念

本文对应 [[成长路径/index|成长路径]] **中优先级**：理解 **TrustZone / 安全启动** 在 BSP 中的分工，不要求实现完整可信链。

---

## TrustZone（ARM）

| 世界 | 典型运行 |
|------|----------|
| **Normal World** | Linux、U-Boot（非安全） |
| **Secure World** | OP-TEE、安全监控、密钥 |

通过 **SMC** 从 Linux 调用安全服务（存储密钥、加密）。

---

## 安全启动链（概念）

```text
ROM (公钥 hash) → 校验 SPL → 校验 U-Boot → 校验 kernel/dtb → (可选) dm-verity rootfs
```

任一环节签名失败 **拒绝启动** 或进入 **恢复模式**。

---

## BSP 责任边界

| 提供方 | 通常交付 |
|--------|----------|
| 芯片厂 | ROM、签名工具、CST、参考 secure boot |
| 方案商 | 烧录流程、密钥注入产线 |
| 产品 | 密钥保管、OTA 签名策略 |

应用开发者多数只需：**启用/关闭 secure boot**、**不要破坏** 签名分区。

---

## 与 OTA

升级包需 **重新签名**；A/B 切换需信任 **bootloader 校验**，见 [[linux/OTA/A-B 分区与回滚策略]]。

---

## 延伸阅读

- [[linux/OTA/index]]
- [[成长路径/index]] 第 4 季度「安全启动 / 合规」
