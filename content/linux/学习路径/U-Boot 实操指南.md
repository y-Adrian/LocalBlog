---
tags:
  - Linux
  - 嵌入式
  - U-Boot
title: U-Boot 实操指南
description: 环境变量、bootcmd、加载 kernel/dtb/initramfs 与串口验证
date: 2026/05/16
---

# U-Boot 实操指南

本文对应 [[成长路径/index|成长路径]] **嵌入式 Linux · 启动链** 高优先级项：在真实或 QEMU 环境中能 **进入 U-Boot 命令行、改环境变量、手动/自动启动内核**。

---

## 学习目标

- 理解 **U-Boot 在启动链** 中的位置：ROM → SPL（可选）→ U-Boot → Linux。
- 能使用 **串口** 进入 U-Boot shell，查看/修改 **环境变量**。
- 能编写 **`bootcmd`**，从 **MMC / TFTP / 内存** 加载 **Image、dtb、initramfs** 并 `booti` / `bootz`。
- 知道 **saveenv**、**defconfig** 与 **升级 U-Boot 本身** 的基本风险。

---

## 启动链中的 U-Boot

| 阶段 | 典型职责 |
|------|----------|
| BootROM | 从固定介质加载下一阶段到 SRAM |
| SPL / TPL | 初始化 DDR、加载完整 U-Boot |
| U-Boot | 外设、存储、网络；加载内核 |
| Linux | 解析 DTB、挂载 rootfs |

板级差异集中在：**存储介质**（eMMC / NAND / SPI NOR）、**启动介质**（拨码 / eFuse）、**是否带安全启动**。

---

## 进入 U-Boot 命令行

1. 串口连接：波特率常见 **115200 8N1**（以 BSP 文档为准）。
2. 上电或复位，在倒计时内按提示键（常见 **空格**、**任意键**）中断自动启动。
3. 提示符多为 `=>` 或 `U-Boot>`。

常用只读命令：

```text
=> version
=> bdinfo
=> printenv
=> mmc list
=> fatls mmc 0:1
```

---

## 环境变量

环境变量保存在 **env 分区**（SPI NOR / eMMC 专用分区等），由 **CONFIG_ENV_*** 决定位置。

| 命令 | 作用 |
|------|------|
| `printenv` | 打印全部或 `printenv bootcmd` |
| `setenv name value` | 设置（仅内存，重启丢失） |
| `saveenv` | 写入持久化存储 |
| `editenv name` | 交互编辑 |
| `env default -a` | 恢复默认（慎用） |

典型变量（名称因板卡而异）：

| 变量 | 含义 |
|------|------|
| `bootcmd` | 自动启动时执行的 U-Boot 脚本 |
| `bootargs` | 传给内核的 cmdline |
| `fdt_addr` / `fdtfile` | 设备树地址或文件名 |
| `kernel_addr_r` / `ramdisk_addr_r` | 加载地址（与内存布局相关） |
| `mmcroot` / `root` | 根文件系统设备描述 |

---

## 手动加载并启动内核（MMC 示例）

假设 SD/eMMC 第一个 FAT 分区上有 `Image`、`imx8mm-evk.dtb`（文件名按 BSP 修改）：

```text
=> setenv loadaddr 0x40400000
=> fatload mmc 0:1 ${loadaddr} Image
=> fatload mmc 0:1 ${fdt_addr} imx8mm-evk.dtb
=> setenv bootargs "console=ttymxc0,115200 root=/dev/mmcblk0p2 rootwait rw"
=> booti ${loadaddr} - ${fdt_addr}
```

说明：

- **ARM64** 常用 `booti`；ARM32 可能用 `bootz`（zImage）。
- 第二参数 `-` 表示无 initramfs；若有 ramdisk：`booti ${loadaddr} ${ramdisk_addr} ${fdt_addr}`。
- `rootwait` 适合 mmc/usb 等慢速块设备。

---

## TFTP 网络启动（开发常用）

主机运行 tftpd，板端网线连通后：

```text
=> setenv ipaddr 192.168.1.100
=> setenv serverip 192.168.1.1
=> setenv netmask 255.255.255.0
=> tftpboot ${loadaddr} Image
=> tftpboot ${fdt_addr} myboard.dtb
=> setenv bootargs "console=ttyS0,115200 root=/dev/nfs nfsroot=192.168.1.1:/nfsroot,v3,tcp ip=dhcp rw"
=> booti ${loadaddr} - ${fdt_addr}
```

适合 **快速迭代内核/dtb**，无需反复烧写 eMMC。

---

## 编写 bootcmd（自动启动）

`bootcmd` 是 **多行脚本**，用 `\;` 分隔命令，例如：

```text
=> setenv bootcmd 'mmc dev 0; fatload mmc 0:1 ${loadaddr} Image; fatload mmc 0:1 ${fdt_addr} myboard.dtb; booti ${loadaddr} - ${fdt_addr}'
=> saveenv
```

更复杂场景可：

- 使用 **`boot.scr`**（mkimage 生成的脚本镜像）+ `source`。
- 在 **Kconfig** 中为板级设置默认 `CONFIG_BOOTCOMMAND`。

修改后务必 **`saveenv`**，再 `reset` 验证自动启动。

---

## 与设备树、rootfs 的衔接

- **dtb**：由 U-Boot 传入内核；地址需落在内核可访问内存，且与 **内核解压后** 不冲突（参考 BSP `CONFIG_SYS_LOAD_ADDR` 等）。
- **bootargs**：必须包含 **`console=`**；根设备 **`root=`** 与分区表一致；NFS 启动需 **`ip=`** / **`nfsroot=`**。
- 若内核 panic 于 **Unable to mount root**：先回到 U-Boot 核对 `bootargs` 与分区，见 [[linux/学习路径/启动排障手册]]。

---

## 常见问题

| 现象 | 排查方向 |
|------|----------|
| 串口无输出 | 波特率、UART 引脚、是否从 SPL 就挂 |
| `Unknown command` | 功能未编译进 U-Boot（`defconfig`） |
| `MMC: no card present` | 供电、模式、设备树 `mmc` 节点与硬件一致 |
| `Wrong Image Format` | 用了 `bootm` 却加载了 `Image`（应 `booti`） |
| 环境变量丢失 | env 分区未擦写成功、`saveenv` 失败 |

---

## 实践清单

- [ ] 打断自动启动，执行 `version` / `bdinfo`
- [ ] `fatload` 加载内核与 dtb 并 `booti` 成功进 Linux
- [ ] 配置 `bootcmd` + `saveenv` 实现冷启动自动进系统
- [ ] （可选）TFTP 启动一次，对比 MMC 启动差异

---

## 延伸阅读

- [[linux/学习路径/启动排障手册]]
- [[linux/学习路径/设备树实战指南]]
- [[linux/学习路径/Buildroot 与厂商 BSP 入门]]
- [[linux/概览/嵌入式Linux基础知识]]
