---
tags:
  - Linux
  - 嵌入式
title: 嵌入式 Linux 基础知识与关键知识点
description: 从体系结构、内核子集、设备树与启动链到 rootfs、构建系统与调试的系统性梳理
date: 2026/05/16
---

# 1 嵌入式 Linux 基础知识与关键知识点

**嵌入式 Linux** 指在资源、形态、生命周期约束明确的硬件上运行 **Linux 内核** 与 **用户空间**（可裁剪），典型场景包括工业控制、网通、车载网关、消费电子网关等。本文按「**宏观栈 → 体系结构底座 → 内核与驱动 → 启动与文件系统 → 工程化与合规**」组织，标出**实践与面试中反复出现**的边界与自检点。

---

## 1.1 嵌入式 Linux 在系统栈中的位置

```
┌─────────────────────────────────────────┐
│ 应用：业务逻辑、协议栈用户态、GUI（可选）   │
├─────────────────────────────────────────┤
│ 用户空间：glibc/musl、BusyBox/systemd、守护进程 │
├─────────────────────────────────────────┤
│ Linux 内核：调度、内存、驱动、网络协议栈…   │
├─────────────────────────────────────────┤
│ Bootloader：U-Boot / Barebox 等         │
├─────────────────────────────────────────┤
│ SoC：CPU + 外设控制器 + BootROM           │
└─────────────────────────────────────────┘
```

**关键认知**：「会写用户态 C/C++」≠「能做好嵌入式 Linux」。中间隔着 **交叉编译与 sysroot、启动链、设备树、根文件系统、内核配置与驱动模型、可观测与更新（OTA）** 等完整一层。

---

## 1.2 计算机体系结构（必读底座）

| 主题 | 关键知识点 | 实践意义 |
|------|------------|----------|
| **CPU 与 ISA** | ARMv7/AArch32、ARMv8‑A/AArch64、RISC‑V 等差异；Thumb / AArch64 执行状态 | 选对工具链 **triplet**（如 `aarch64-linux-gnu` vs `arm-none-eabi`） |
| **内存层次** | 寄存器 → Cache → DDR；外设 **MMIO** 物理地址区间 | **DMA 与 Cache 一致性**（`dma_map_*` / `dma_sync_*`）；对齐与带宽 |
| **MMU** | 页表、TLB；用户/内核虚拟地址空间 | 用户指针 ≠ 物理地址；驱动里 `copy_to_user` / `ioremap` 等语义 |
| **中断** | IRQ、GIC；硬中断与下半部 | 硬中断上下文不可睡眠；耗时工作下放 **workqueue** 等 |
| **异常级别（ARM）** | EL0～EL3、TrustZone（按需） | 安全启动、TEE 与普通 Linux 驱动的责任边界 |

**应能口述**：为何不能在中断里 **睡眠**；为何 **DMA buffer** 往往要 **cache line 对齐** 并走 **统一 DMA API** 而不是自算物理地址写寄存器（IOMMU 场景下尤其错误）。

---

## 1.3 Linux 内核基础（嵌入式最常碰的子集）

### 1.3.1 进程与调度

- **进程/线程** 与 `task_struct`；CFS 调度基本概念。
- **上下文划分**：进程上下文、硬中断上下文、软中断上下文；**可阻塞**与**不可阻塞** API 边界。

### 1.3.2 内存管理

- 物理页、伙伴系统；**slab**、`kmalloc` / `vmalloc` 使用场景区分。
- **mmap**、缺页、`copy_to_user` / `copy_from_user`。
- **OOM**、水位线与嵌入式小内存板上的行为。

### 1.3.3 同步

- **spinlock**、**mutex**、**rwlock**；RCU（了解即可）。
- **spinlock 持有期间**在典型非 RT 内核上不可睡眠；死锁排查：加锁顺序、`lockdep`（若配置开启）。

### 1.3.4 设备模型

- **bus / device / driver**；`probe` / `remove` 与电源管理钩子（按需）。
- **sysfs** 属性与 **uevent**（与 `/dev` 节点生成相关，理解即可）。

### 1.3.5 块设备与网络（栈边）

- 块层与 **MTD/UBI** 路线和 **eMMC 块设备 + ext4** 路线的差异（见「存储」一节）。
- **`sk_buff`**、网络分层；与 DPDK 等用户态绕过栈方案正交（按产品选型）。

**与设备树衔接**：现代 ARM/ AArch64 嵌入式上 **`platform_driver`（及总线驱动）与 DT `compatible` 匹配** 是入门驱动的第一关。

---

## 1.4 设备树（Device Tree）

设备树用 **`.dts` / `.dtsi`** 描述硬件：CPU、内存、时钟、GPIO、I2C/SPI 外设等，编译为 **`.dtb`**，由内核在启动早期解析并与驱动匹配。

| 概念 | 说明 |
|------|------|
| **compatible** | 驱动匹配字符串，如 `"vendor,model"`；可多个字符串 fallback |
| **reg** | MMIO 或总线地址范围：`<addr size …>` |
| **interrupts** | 中断 specifier，依赖父节点 **interrupt-controller** 定义 |
| **phandle** | 句柄，用于引用时钟、GPIO、reset 等 |
| **status** | `"okay"` / `"disabled"`；板级可覆盖 SoC 默认 |

**实践要点**：

- 属性合法性以 **内核 `Documentation/devicetree/bindings`**（或你使用内核版本的等价文档）为**唯一权威**。
- **分层**：SoC 公版 **`.dtsi`** + 板级 **`.dts`** 追加/覆盖；减少在板级重复描述。

---

## 1.5 Linux 设备驱动（入门到进阶路径）

### 1.5.1 字符设备

- `cdev`、`file_operations`（`open`/`read`/`write`/`ioctl`/`mmap`/`release`）。
- 主次设备号、`devtmpfs` 与 `/dev` 节点。

### 1.5.2 平台与总线型驱动

- **platform_driver** + DT 匹配。
- **I2C / SPI**：`i2c_client`、`spi_device` 与核心消息 API。

### 1.5.3 阻塞与并发

- **wait_queue**；`poll` / `epoll` 侧非阻塞；环形缓冲区与生产者消费者模型。

### 1.5.4 中断与下半部

- `request_irq`、**threaded irq**；**tasklet**（历史路径仍可见）、**workqueue**。

### 1.5.5 DMA

- **`dma_alloc_coherent`**、`dma_map_single` / `dma_unmap_single`；**Cache 与 IOMMU** 下为何不能假设「VA 线性减常数 = PA」。

### 1.5.6 常见子系统（按项目选学）

- **GPIO / Pinctrl**、**Regulator**、**Common Clock**、**PWM**、**IIO（ADC）**、**RTC**、**Watchdog**。

**里程碑**：能独立完成 **最小内核模块**（`printk` + sysfs 属性）或 **GPIO 点灯**，并会用 `dmesg`、`/sys` 与 `insmod`/`rmmod` 闭环调试。

---

## 1.6 启动流程（Boot Flow）

典型软件链（名称因芯片厂商而异）：

- **BootROM**：固化在片内，从 SPI NOR、eMMC、UART 等加载下一阶段。
- **SPL / FSBL**：极小阶段，完成 DDR 最小初始化等。
- **U-Boot / Barebox**：环境变量、`bootcmd`、加载 **Image/zImage + .dtb**、可选 **initramfs**；网络刷机（TFTP/DFU）常在此层。
- **Linux**：自解压/入口、子系统初始化、挂载 rootfs。
- **init**：BusyBox `init`、**systemd** 或自定义 PID 1。

**内核命令行（`bootargs`）** 常见项：`console=`、`root=`、`rootfstype=`、`rootwait`、`quiet`、`mem=` 等；**earlyprintk** 与 **正确 console 设备与波特率** 是排「黑屏」的第一手段。

**量产相关概念**：**FIT Image**、**A/B 分区**、**recovery**、**Secure Boot 链**（ROM→SPL→U-Boot→Kernel 验签思路，细节因平台而异）。

---

## 1.7 交叉开发与工具链（概要）

| 概念 | 说明 |
|------|------|
| **Host / Target** | 在 PC 上编译，在板子上运行 |
| **交叉前缀** | 如 `aarch64-linux-gnu-`；**bare-metal** 用 `arm-none-eabi-`（无 Linux libc） |
| **sysroot** | 目标根文件系统的头文件与库，供链接与 `#include` 解析 |
| **ABI** | EABI、硬浮点 `hf` 等；须与 rootfs、内核模块编译环境一致 |

**实践**：会用 `readelf -h`、`file`、（在目标机上的）`ldd` 解释 **Machine / ABI / 缺 .so**；链接阶段缺库与运行阶段缺库是两类问题。

更长的交叉编译工程化说明可单独成文（CMake toolchain、Meson、`PKG_CONFIG_SYSROOT_DIR` 等）。

---

## 1.8 根文件系统（rootfs）与 init

- **FHS**：`/bin`、`/sbin`、`/etc`、`/lib`、`/usr`、`/var`、`/proc`、`/sys`、`/dev` 的职责分工。
- **glibc vs musl**：体积、兼容性、生态与合规权衡。
- **BusyBox**：单二进制多 applet，适合小系统；**systemd** 适合复杂依赖与并行启动。
- **动态链接**：目标板需带齐 **解释器与依赖 .so**，或评估 **静态链接** 的体积与 NSS 等陷阱。
- **initramfs**：早期用户态与 **pivot_root** 到真实 root 的场景（若使用）。

---

## 1.9 构建系统（工程级）

| 系统 | 特点 | 典型适用 |
|------|------|----------|
| **Buildroot** | Kconfig/Makefile，上手快，镜像直出 | 小到中型项目、快速原型 |
| **Yocto / OpenEmbedded** | recipe、layer、可复现性强 | 多 SKU、长周期维护、团队分工 |
| **厂商 BSP** | 芯片商锁定版本的内核/U-Boot/工具链 | 先跑通再评估升级与上游化 |

**要点**：`defconfig`、包选择、**post-build/rootfs overlay**、**SPDX/许可证清单** 与交付物审计。

---

## 1.10 存储与文件系统

| 介质 | 注意点 |
|------|--------|
| **Raw NAND** | 坏块、ECC、磨损均衡；常见 **UBI + UBIFS**（或历史 JFFS2） |
| **eMMC / SD** | 块设备 + FTL；常见 **ext4**；掉电一致性与 `fsync`、分区布局 |
| **SPI NOR** | 常放 kernel、dtb、小 rootfs 或只读分区 |
| **分区** | MBR/GPT、**A/B slot**、只读根 + **overlay** |

**关键**：**只读 root + overlay** 与 **双分区回滚** 在量产与 OTA 中极常见；UBIFS 与 ext4-on-eMMC 的掉电语义不同，勿混用经验。

---

## 1.11 调试手段（建议掌握顺序）

| 手段 | 用途 |
|------|------|
| **串口 console** | 最早期的 `printk` 与 shell |
| **dmesg / loglevel** | 驱动与内核子系统日志 |
| **/proc / /sys** | 运行时状态与调参 |
| **gdbserver + 交叉 gdb** | 用户态单步 |
| **ftrace / perf** | 延迟与热点（资源允许时） |
| **JTAG/SWD** | 早期启动与硬死机（视硬件） |
| **kgdb、kdump** | 内核在线调试与崩溃转储（进阶） |

---

## 1.12 实时与确定性（按需）

- 通用 Linux 调度为 **尽力而为**；硬实时常落在 **MCU / RTOS 侧** 或专用协处理器。
- **PREEMPT_RT**：缩短不可抢占区，改善最坏情况延迟；需 **配置 + 实测**（如 `cyclictest`），避免「感觉实时」。

---

## 1.13 网络与安全（现代产品）

- Socket、TCP/UDP 基础；若做网关需了解 **nftables/iptables** 边界。
- **SSH**、**OTA 签名**、**Secure Boot** 链与密钥管理。
- **capabilities**、非 root 运行、最小权限面。
- **内核 LTS** 与 CVE 流程：版本选择是供应链问题，不单是技术偏好。

---

## 1.14 许可证与合规

- **GPL**：与内核链接的模块/衍生作品的传播义务（具体以法务解释为准）；`MODULE_LICENSE` 与 **EXPORT_SYMBOL_GPL** 等是内核生态的合规信号，不是装饰。
- 发布物中 **BusyBox、内核、U-Boot、第三方库** 的许可证聚合与 **manifest**。

---

## 1.15 推荐学习路径（可执行顺序）

- Shell、Makefile、Git：能在命令行完成编辑、编译、追溯。
- 体系结构入门：MMU、异常、中断、Cache 与 DMA 直觉。
- **应用交叉编译**：hello world 动态/静态各一次，`readelf` 看懂 **Machine / ABI**。
- **Buildroot 或厂商 BSP**：串口进 shell，会改 `bootargs`、替换 dtb 验证。
- **设备树**：对照原理图改 **GPIO/LED** 节点并 `probe` 成功。
- **字符设备驱动**：模块 + sysfs/ioctl 与用户态通信。
- **I2C/SPI** 类驱动（按硬件选学）。
- **Yocto** 或更深子系统（网络、存储、调度）：按职业方向分叉。

---

## 1.16 自检清单（初/中级常见要求）

- [ ] 说清从上电到 **shell 提示符** 的大致软件阶段。
- [ ] 解释 **DT `compatible` 与驱动 `probe`** 如何对应。
- [ ] 说明 **中断上下文与进程上下文** 各能/不能做什么。
- [ ] 配置并成功使用 **串口内核日志 + rootfs 挂载**。
- [ ] 独立完成 **交叉编译** 并在目标板运行，解决常见 **动态库缺失**。
- [ ] 使用 **Buildroot 或 Yocto** 之一生成过可启动镜像。
- [ ] 编写或修改过 **简单内核模块**，理解 **许可证与导出符号**。
- [ ] 区分 **NAND+UBI** 与 **eMMC+ext4** 在一致性与工具链上的差异。
- [ ] （选做）了解 **PREEMPT_RT** 与延迟测量的基本概念。

---

## 1.17 延伸阅读与权威来源

- 内核源码树 **`Documentation/`**（含设备树 bindings）。
- **U-Boot**、**Barebox** 官方手册。
- 书籍：*Linux Device Drivers*（思路仍有用，API 需对照当前内核）、体系结构侧 ARM 官方或经典教材。
- 社区：**kernel.org**、**elinux.org**、SoC 厂商 Wiki。

---

*硬件与 BSP 差异远大于抽象总结；具体寄存器、时钟与启动介质以 SoC **TRM** 与厂商 BSP 为准。本文标题不叠数字编号，便于配合 Markdown 自动编号插件使用。*
