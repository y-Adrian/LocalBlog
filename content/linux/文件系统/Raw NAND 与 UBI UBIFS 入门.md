---
tags:
  - Linux
  - 嵌入式
  - UBI
  - NAND
title: Raw NAND 与 UBI UBIFS 入门
description: ubiformat、ubinize、attach 与掉电升级注意点
date: 2026/05/16
---

# Raw NAND 与 UBI UBIFS 入门

本文对应 [[成长路径/index|成长路径]] **高优先级**：在 **Raw NAND** 上使用 **UBI + UBIFS** 作为可读写根文件系统，并理解 **坏块** 与 **掉电** 风险。

---

## 学习目标

- 区分 **MTD 原始设备** 与 **UBI 卷**、**UBIFS** 挂载层。
- 使用 **`ubiformat`**、**`ubinize`** 初始化 flash 并创建卷。
- 能 **`ubiattach`**、**`mount -t ubifs`** 挂载根文件系统。
- 了解 OTA 时 **整卷更新** 与 **双卷** 策略要点。

---

## 层次关系

```text
NAND 芯片
  → MTD 设备 (/dev/mtdN)
    → UBI (/dev/ubi0, /dev/ubi0_0 卷)
      → UBIFS (mount ubi0:rootfs)
```

| 层 | 作用 |
|----|------|
| MTD | 暴露擦除块、OOB；屏蔽坏块重映射（由驱动/控制器处理） |
| UBI | 在 MTD 上做磨损均衡、坏块管理、逻辑卷 |
| UBIFS | 日志型文件系统，挂载在 UBI 卷上 |

---

## 前置：确认 MTD 分区

```bash
cat /proc/mtd
mtdinfo /dev/mtdX
```

分区需与 **设备树 `fixed-partitions`** 或 **cmdline mtdparts** 一致。错误分区会导致 **擦除错误区域**。

---

## 首次格式化（生产慎用）

在 **空片** 或确认可全盘擦除时：

```bash
# 对整片 NAND 做 UBI 格式化（会清空数据）
ubiformat /dev/mtdX

# 根据 ubinize.cfg 创建卷
ubinize -o /tmp/ubi.img -m 2048 -p 128KiB -s 512 ubinize.cfg
ubiupdatevol /dev/ubi0 -t 0 -f /tmp/ubi.img   # 具体命令依镜像类型调整
```

典型 **`ubinize.cfg`** 片段：

```ini
[ubifs]
mode=ubi
image=/path/to/ubifs.img
vol_id=0
vol_size=120MiB
vol_type=dynamic
vol_name=rootfs
vol_alignment=1
```

**`vol_size`** 需小于分区容量并预留 **坏块与元数据**。

---

## 启动时 attach 与挂载

内核启动参数示例：

```text
ubi.mtd=4 root=ubi0:rootfs rootfstype=ubifs rw
```

用户态手动：

```bash
ubiattach -p /dev/mtd4
mount -t ubifs ubi0:rootfs /mnt
```

若 attach 失败，查 **dmesg** 中 `ubi` / `mtd` 错误码。

---

## 掉电与升级注意点

| 风险 | 说明 |
|------|------|
| 格式化中途掉电 | 可能需重新 `ubiformat` 或 JTAG 恢复 |
| 写 rootfs 卷时掉电 | 使用 **双分区 A/B** 或 **先写备用卷再切换** |
| 坏块增多 | UBI 会标记；监控 `ubi0` 可用 PEB |
| 未对齐写入 | 镜像需按 **最小 I/O 单元** 生成 |

OTA 流程应 **校验镜像** → 写入 **非活动卷** → **原子切换 boot 环境** → 启动成功后再擦旧卷。

---

## 与 eMMC 的差异（速记）

| 项目 | eMMC + ext4 | NAND + UBIFS |
|------|-------------|--------------|
| 介质接口 | 块设备 | MTD 原始 |
| 坏块 | 控制器屏蔽 | UBI 管理 |
| 典型容量 | GB 级 | MB～GB |
| 成本 | 较高 | 较低（大容量时） |

详见 [[linux/文件系统/NAND 与 eMMC 选型对照]]。

---

## 实践清单

- [ ] 读取本板 `/proc/mtd` 并对应原理图
- [ ] 在开发环境用 `ubinize` 生成卷并挂载只读测试
- [ ] 模拟一次 **升级失败回滚**（双卷或备份 env）

---

## 延伸阅读

- [[linux/内核机制/存储与IO子系统]]
- [[linux/文件系统/eMMC 与 ext4 根文件系统]]
- [[linux/学习路径/启动排障手册]]
