---
tags:
  - Linux
  - OTA
title: A-B 分区与回滚策略
description: 双 rootfs 切换、启动计数与失败回滚
date: 2026/05/16
---

# A/B 分区与回滚策略

本文对应 [[成长路径/index|成长路径]] **OTA 高优先级**：理解 **A/B 分区** 升级模型与 **回滚** 触发条件。

---

## 基本模型

| 分区 | 作用 |
|------|------|
| **slot A** | 当前或备用 rootfs |
| **slot B** | 升级写入目标 |
| **bootloader env** | 记录 **active slot**、**retry 计数** |

升级流程：**下载 → 校验 → 写入非活动 slot → 切换 env → 重启 → 健康检查 → 确认或回滚**。

---

## 启动切换（U-Boot 示例）

环境变量示意：

```text
bootslot=a
bootcount=0
bootlimit=3
```

`bootcmd` 根据 `bootslot` 选择 `root=/dev/mmcblk0p2` 或 `p3`。

启动失败时 **bootcount++**，超过 **bootlimit** 则切换 slot 并复位计数。

---

## 健康检查（用户态）

新系统启动后 **systemd/onshot** 或 **init 脚本**：

1. 关键服务就绪（网络、业务进程）。
2. 自检通过后：`fw_setenv bootcount 0` 确认 slot。
3. 失败则：不确认，下次启动由 bootloader **回滚**。

---

## 与文件系统

- eMMC 上 **两个 ext4 分区** 常见，见 [[linux/文件系统/eMMC 与 ext4 根文件系统]]。
- NAND 上可为 **两个 UBI 卷**，见 [[linux/文件系统/Raw NAND 与 UBI UBIFS 入门]]。

---

## 安全

- 镜像 **签名验证**（RSA / AVB）在写入前完成。
- **加密** 与 **A/B** 正交，可组合。

---

## 实践清单

- [ ] 画本板 **分区表** 标 A/B
- [ ] 模拟一次 **升级失败** 验证回滚到旧 slot

---

## 延伸阅读

- [[linux/学习路径/U-Boot 实操指南]]
- [[linux/学习路径/最小可启动工程指南]]
