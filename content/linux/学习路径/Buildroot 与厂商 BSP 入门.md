---
tags:
  - Linux
  - 嵌入式
title: Buildroot 与厂商 BSP 入门
description: 串口 shell、bootargs、替换 dtb 验证——跑通第一块能启动的板子
---

# Buildroot 与厂商 BSP 入门

本文是 **嵌入式 Linux 学习路径** 第四阶段：用 **Buildroot** 或 **芯片厂商 BSP** 跑通 **上电 → 内核日志 → rootfs shell**。完成后你应能：**改 `bootargs`、换 `.dtb`、定位启动失败阶段**，并理解 **镜像里各组件从哪来**。

---

## 学习目标

- 区分 **BootROM → SPL → U-Boot → Kernel → init** 各阶段现象。
- 配置 **串口 console** 与 **root 挂载**（`root=`、`rootfstype=`）。
- 在 U-Boot 或 boot 脚本中加载 **Image + dtb**；会 **替换 dtb 做硬件描述验证**。
- 使用 Buildroot **defconfig → 镜像** 或 BSP **快速启动文档** 完成最小闭环。

---

## 启动链与「黑屏」定位

| 阶段 | 典型现象 | 排障手段 |
|------|----------|----------|
| BootROM/SPL | 无任何串口输出 | JTAG、GPIO 点灯、示波器 SPI 时钟 |
| U-Boot | `U-Boot>` 或厂商 logo 后停 | `printenv`、`bootcmd`、存储介质 |
| Kernel | `Starting kernel ...` 后静默 | **`earlyprintk`**、**`console=tty*` 波特率** |
| rootfs | `Kernel panic - not syncing: VFS` | **`root=`** 设备名、驱动、文件系统类型 |
| init | 反复重启 / login | **init 脚本**、getty 配置 |

**第一技能**：确认 **串口线、电平（3.3V TTL）、波特率、设备树里 stdout 路径** 一致。

---

## 串口 console 实战

### 主机侧

```bash
picocom -b 115200 /dev/ttyUSB0
# 或 minicom -D /dev/ttyUSB0 -b 115200
```

### 内核命令行（`bootargs`）

常见片段：

```text
console=ttyS0,115200n8 earlyprintk root=/dev/mmcblk0p2 rootwait rw
```

- **`console=`**：内核 printk 与用户 login 常共用（依配置）；**tty 名必须与硬件一致**（`ttyS0` vs `ttyAMA0` vs `ttymxc0`）。
- **`earlyprintk`**：极早期日志（架构/配置相关）。
- **`rootwait`**：块设备未就绪时等待（SD/eMMC 常见）。

### U-Boot 修改 bootargs

```text
setenv bootargs 'console=ttyS0,115200 root=/dev/mmcblk0p2 rootwait rw'
saveenv
boot
```

或编辑 **boot.scr / extlinux.conf / FIT**（依平台）。

---

## 替换 dtb 验证硬件描述

### 为何先会换 dtb

- **改设备树** 比 **改内核** 迭代快；验证 **GPIO/LED/串口** 节点是否被内核正确解析。
- 板级 **`.dts`** 编译为 **`.dtb`**，由 bootloader 传给内核。

### U-Boot 手动加载（示例思路）

```text
fatload mmc 0:1 ${kernel_addr_r} Image
fatload mmc 0:1 ${fdt_addr_r} board.dtb
booti ${kernel_addr_r} - ${fdt_addr_r}
```

将 PC 上编译的 **`board.dtb`** 拷到 boot 分区替换，重启观察 **`/proc/device-tree`** 或驱动 **probe** 日志。

### 内核侧确认

```bash
ls /proc/device-tree/
cat /proc/device-tree/model
dmesg | grep -i 'machine model'
```

---

## Buildroot 最小路径

### 获取与配置

```bash
git clone https://github.com/buildroot/buildroot.git
cd buildroot
make menuconfig
# Target options → 选 ARM AArch64 等
# Toolchain → 选用 Buildroot 内置或 external toolchain
# System configuration → 设 root 密码、getty on serial
# Kernel / Bootloader → 选版本与 defconfig
make -j"$(nproc)"
```

### 输出物（典型）

- **`output/images/`**：`rootfs.ext4`、`zImage`/`Image`、**`*.dtb`**、`u-boot.bin`、**`sdcard.img`**（视配置）。
- **`output/host/`**：宿主机工具；**`output/staging/`**：**sysroot**（与交叉编译阶段衔接）。

### 常用后处理

- **`BR2_ROOTFS_OVERLAY`**：追加文件到 rootfs。
- **`post-build.sh`**：自定义打包。
- **`BR2_PACKAGE_*`**：选 openssh、iperf3 等。

---

## 厂商 BSP 路径

### 典型交付物

- **预编译镜像** + **烧录工具**（SD、USB、JTAG flash）。
- **内核/U-Boot 源码树** + **固定 toolchain** + **文档 PDF**。
- **环境脚本** `source setup-env.sh`。

### 建议工作流

- **先跑通官方镜像**，确认硬件 OK。
- **再 git 化** 本地改动；厂商更新时 **tag 基线 + rebase/cherry-pick**。
- **不要** 一上来就换最新主线内核——先 **BSP 默认版本** 闭环。

---

## rootfs 挂载失败专题

| 日志关键词 | 可能原因 |
|------------|----------|
| `Unknown block device` | **`root=`** 错、驱动未进内核或未加载 |
| `Cannot open root device` | 分区号错、GPT 与 `root=` 不一致 |
| `VFS: Unable to mount root fs on unknown-block` | **rootfstype** 缺失、ext4 未编译进内核 |
| `Waiting for root device` | 缺 **`rootwait`** 或设备初始化慢 |

**实践**：U-Boot 里 **`ls mmc 0`** / **`part list`** 对照 **`root=/dev/mmcblk0pN`**。

---

## 实践练习

- [ ] 用 **picocom** 抓完整启动 log 从 power-on 到 login。
- [ ] 改 **`bootargs`** 故意写错 `root=`，再改对，理解 panic 信息。
- [ ] 编译 **仅改 `model` 字符串** 的 dts，换 dtb 后在 **`/proc/device-tree/model`** 验证。
- [ ] Buildroot 打开一个额外 package（如 **`htop`**），刷机后在板端运行。

---

## 阶段验收

- [ ] 独立画出 **存储布局**（boot 分区 / rootfs）与 **各镜像位置**。
- [ ] 能在 **5 分钟内** 说清当前板子 **bootcmd 做了什么**。
- [ ] 知道 **kernel 与 dtb 版本不匹配** 时可能出现的现象（不 probe 某兼容字符串等）。

---

## 下一阶段衔接

- **设备树**：在会 **换 dtb** 的基础上，**自己改 GPIO/LED 节点** 并写驱动匹配。
- **字符设备**：在 shell 可用后 **insmod** 模块。

---

## 参考

- Buildroot **Manual**（https://buildroot.org/docs.html）
- U-Boot **Documentation**（booti、FIT、DFU）
- 板卡 **Quick Start Guide**（厂商）

---

*烧录与分区操作有变砖风险；保留 **原厂 recovery** 与 **串口 interrupt 进 U-Boot** 手段。*
