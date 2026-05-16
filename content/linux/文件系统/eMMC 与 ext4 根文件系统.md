---
tags:
  - Linux
  - 嵌入式
  - 文件系统
title: eMMC 与 ext4 根文件系统
description: 分区、mkfs、只读根文件系统与 fsck 策略
date: 2026/05/16
---

# eMMC 与 ext4 根文件系统

本文对应 [[成长路径/index|成长路径]] **高优先级**：在 eMMC 上规划分区、制作 **ext4 根文件系统**，并理解 **只读根** 与 **掉电** 注意点。

---

## 学习目标

- 为 eMMC 划分 **boot / root / data** 等分区并写入镜像。
- 使用 **ext4** 作为可读写根文件系统，配置 **`root=`** 与 **`PARTUUID`**。
- 了解 **只读根**（overlay / remount ro）与 **`fsck`** 策略。

---

## eMMC 与块设备

Linux 中常见节点：

| 设备 | 含义 |
|------|------|
| `/dev/mmcblk0` | 整块 eMMC |
| `/dev/mmcblk0boot0` | 硬件 boot 分区（若支持） |
| `/dev/mmcblk0p1` | 第一个 GPT/MBR 分区 |

查看分区：

```bash
lsblk -f
cat /proc/partitions
```

---

## 分区规划示例

| 分区 | 大小（示例） | 用途 | 文件系统 |
|------|-------------|------|----------|
| p1 | 64–256 MiB | boot（Image、dtb） | FAT |
| p2 | 1 GiB+ | rootfs | ext4 |
| p3 | 剩余 | 数据、日志 | ext4 |

使用 **GPT** 便于 `PARTUUID=`；与 U-Boot **`distro_bootpart`** 对齐。

```bash
# 在 PC 或 initramfs 中对块设备操作（示例 /dev/sdX）
sudo parted /dev/sdX --script mklabel gpt \
  mkpart boot fat32 1MiB 257MiB \
  mkpart root ext4 257MiB 100%
```

---

## 制作 ext4 根文件系统

```bash
sudo mkfs.ext4 -L rootfs /dev/sdX2
sudo mkdir -p /mnt/rootfs
sudo mount /dev/sdX2 /mnt/rootfs
sudo tar -C /path/to/rootfs-staging -cf - . | sudo tar -C /mnt/rootfs -xf -
sudo umount /mnt/rootfs
```

Buildroot / Yocto 产物通常是 **rootfs.tar** 或 **ext4 镜像**，按 BSP 文档 **`dd`** 或 **`bmaptool`** 烧录。

---

## 启动参数

```text
root=/dev/mmcblk0p2 rootwait rw
```

或（推荐，不依赖枚举顺序）：

```text
root=PARTUUID=xxxx-xxxx rootwait rw
```

`rootwait` 等待设备就绪，避免 **`Waiting for root device`**。

---

## 只读根文件系统

嵌入式产品常将根分区 **只读** 防掉电损坏：

```bash
# /etc/fstab 示例
/dev/mmcblk0p2  /  ext4  ro,noatime  0  1
tmpfs           /tmp tmpfs defaults  0  0
```

可写数据放到 **独立 data 分区** 或 **overlayfs**（upper 在 data 分区）。

调试时临时可写：

```bash
mount -o remount,rw /
```

---

## fsck 与 journal

ext4 默认 **journal**；异常掉电后下次挂载可能触发 **fsck**。

| 场景 | 建议 |
|------|------|
| 开发板 | 默认即可，`tune2fs -c 0 -i 0` 按需 |
| 量产只读根 | `ro` 挂载 + 独立可写 data |
| 首次烧录 | 确保镜像完整，避免半成品 rootfs |

检查：

```bash
sudo dumpe2fs /dev/mmcblk0p2 | grep -i journal
```

---

## 与 OTA / A/B 的关系

A/B 更新常有两套 root 分区，由 bootloader 或 userspace 切换 `root=`（见成长路径 OTA 专题）。

---

## 实践清单

- [ ] 列出本板 `mmcblk` 分区表并拍照存档
- [ ] 用 `mkfs.ext4` + `tar` 部署一次 rootfs
- [ ] 配置 `PARTUUID` 启动成功
- [ ] 尝试 `ro` 挂载 + data 分区写入

---

## 延伸阅读

- [[linux/内核机制/存储与IO子系统]]
- [[linux/文件系统/Raw NAND 与 UBI UBIFS 入门]]
- [[linux/文件系统/NAND 与 eMMC 选型对照]]
- [[linux/学习路径/启动排障手册]]
