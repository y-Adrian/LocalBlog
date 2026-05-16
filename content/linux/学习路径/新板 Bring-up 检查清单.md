---
tags:
  - Linux
  - 嵌入式
  - bring-up
title: 新板 Bring-up 检查清单
description: Bootloader、内核、设备树与 rootfs 一体化 bring-up 流程
date: 2026/05/16
---

# 新板 Bring-up 检查清单

本文对应 [[成长路径/index|成长路径]] **方向定位**：独立 bring-up **Bootloader + 内核 + DT + rootfs** 的可执行清单。

---

## 阶段 1：硬件与启动 ROM

- [ ] 电源、时钟、复位时序符合 TRM
- [ ] 串口 debug 引脚与电平正确
- [ ] BootROM 能从 **SD / eMMC / NOR / UART** 加载 SPL（按设计）
- [ ] 首条串口输出（哪怕是 ROM 码）

---

## 阶段 2：Bootloader（U-Boot / SPL）

- [ ] SPL 初始化 DDR，跳转 U-Boot
- [ ] `printenv` / `bdinfo` 正常
- [ ] 能 `fatload` / `tftp` 加载 **Image + dtb**
- [ ] `booti` 进入内核（哪怕随后 panic）

见 [[linux/学习路径/U-Boot 实操指南]]。

---

## 阶段 3：内核

- [ ] `defconfig` + 板级 **device tree** 进内核源码或 `BR2_LINUX_KERNEL_CUSTOM_DTS_PATH`
- [ ] 串口 **earlycon** 有输出：`earlycon=xxx,115200`
- [ ] 必要驱动 = **y** 或模块：MMC、网口、flash、clock、pinctrl
- [ ] `uname -a` 与预期一致

---

## 阶段 4：设备树

- [ ] 板级 `.dts`：`compatible`、`memory`、`chosen stdout`
- [ ] 外设节点：`status = "okay"`、**reg / interrupts / clocks** 与原理图一致
- [ ] `/proc/device-tree` 与 dts 一致

见 [[linux/学习路径/设备树实战指南]]、[[linux/驱动与模块/platform 驱动完整案例]]。

---

## 阶段 5：rootfs

- [ ] Buildroot/Yocto 产出 rootfs，见 [[linux/学习路径/最小可启动工程指南]]
- [ ] `root=` / `PARTUUID` 正确，见 [[linux/文件系统/挂载参数与启动场景]]
- [ ] 登录 getty、基本命令可用

---

## 阶段 6：驱动与验证

- [ ] 关键外设 probe 成功（dmesg 无 `-probe failed`）
- [ ] 网口 `ping`、存储读写、GPIO/LED 测试
- [ ] 预留 **sysfs 调试节点**，见 [[linux/驱动与模块/sysfs 与 proc 调试接口]]

---

## 交付物

| 项 | 内容 |
|----|------|
| 仓库 | defconfig、dts、Buildroot external、README |
| 镜像 | 版本号 + sha256 |
| 文档 | 启动链图、分区表、已知问题 |

---

## 延伸阅读

- [[linux/学习路径/启动排障手册]]
- [[linux/概览/嵌入式Linux基础知识]]
