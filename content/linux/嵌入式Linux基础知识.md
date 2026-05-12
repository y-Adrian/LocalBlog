# 1 嵌入式 Linux 基础知识与关键知识点
  
嵌入式 Linux 指在资源受限、形态固定的硬件上运行裁剪或完整的 Linux 内核与用户空间，典型场景包括工业控制、网通设备、车载、消费电子等。下面按「先宏观、后内核、再系统与工程」组织，并标出**面试与实践中反复出现的关键点**。

---

  

## 1.1 嵌入式 Linux 在系统栈中的位置

  

```

┌─────────────────────────────────────────┐

│ 应用层：业务逻辑、中间件、GUI（可选） │

├─────────────────────────────────────────┤

│ 用户空间：C 库、glibc/musl、shell、守护进程 │

├─────────────────────────────────────────┤

│ Linux 内核：调度、内存、驱动、网络栈… │

├─────────────────────────────────────────┤

│ Bootloader：U-Boot / Barebox 等 │

├─────────────────────────────────────────┤

│ SoC：CPU + 外设控制器 + BootROM │

└─────────────────────────────────────────┘

```

  

**关键认知：**

「会写应用层 C/C++」≠「能做好嵌入式 Linux」。中间隔着 **交叉编译、启动链、根文件系统、驱动与设备树、内核配置、调试手段** 等一整层。

  

---

  

## 1.2 计算机体系结构（必读底座）

  

| 主题 | 关键知识点 | 实践意义 |

|------|-------------|----------|

| **CPU 与 ISA** | ARMv7/AArch32、ARMv8-A/AArch64、RISC-V 等指令集差异；Thumb/ AArch64 混编概念 | 选对工具链三元组 `arch-vendor-os-eabi` |

| **内存层次** | 寄存器 → Cache（L1/L2）→ 主存（DDR）→ 外设寄存器映射到 **物理地址** | 理解 DMA cache 一致性、对齐与性能 |

| **MMU** | 虚拟地址、页表、TLB；用户态/内核态地址空间 | 用户程序看到的地址 ≠ 物理地址；驱动里 `ioremap` 等 |

| **总线** | AXI/AHB/APB；PCIe（部分嵌入式 SoC） | 外设挂在哪条总线影响带宽与延迟 |

| **中断** | IRQ、FIQ（ARM）、GIC；上半部/下半部 | 实时性与响应；不能在中断上下文做阻塞 |

| **异常级别（ARM）** | EL0～EL3、TrustZone 概念（按需） | 安全启动、TEE 与普通过内核开发的分界 |

  

**关键点：** 能解释「**为什么驱动里不能直接解引用用户传来的指针**」「**DMA 前后为何要 flush/invalidate cache**」。

  

---

  

## 1.3 Linux 内核基础（嵌入式最常碰到的子集）

  

### 1.3.1 进程与调度

  

- 进程、线程、task_struct；CFS 调度器基本概念。

- **上下文**：进程上下文、中断上下文、软中断/tasklet/workqueue。

- **关键点：** 中断里不能睡眠；可能睡眠的代码要放在进程上下文或可阻塞的 workqueue。

  

### 1.3.2 内存管理

  

- 物理页、伙伴系统、slab/kmalloc、vmalloc。

- **mmap**、缺页、copy_to_user / copy_from_user。

- **关键点：** 内核栈很小；大数组不要放栈上；理解 OOM 与内存水位。

  

### 1.3.3 同步与锁

  

- spinlock、mutex、semaphore、rwlock；RCU（了解即可）。

- **关键点：** spinlock 持有期间不可抢占（非 RT 内核上典型假设）；死锁排查思路。

  

### 1.3.4 块设备与网络（栈边）

  

- 块层、MTD/NAND 与常规块设备的区别（见下文存储）。

- sk_buff、netdevice；socket 与协议栈分层。

  

### 1.3.5 设备模型（sysfs / driver model）

  

- bus_type、device、driver、class；probe/remove 与生命周期。

- **关键点：** 现代嵌入式 ARM 上 **设备树（DT）** 与 **platform_driver** 的匹配关系。

  

---

  

## 1.4 设备树（Device Tree）—— ARM 嵌入式核心

  

设备树用 **`.dts` / `.dtsi`** 描述硬件：CPU、内存、时钟、GPIO、I2C/SPI 上的器件等，编译为 **`.dtb`** 由内核在启动时解析。

  

| 概念 | 说明 |

|------|------|

| **compatible** | 驱动匹配字符串，如 `"vendor,model"` |

| **reg** | 寄存器物理地址与长度 |

| **interrupts** | 中断号及触发方式（与 GIC/父节点相关） |

| **phandle / 引用** | 时钟、GPIO、复位线等通过句柄关联 |

| **status = "disabled"`** | 节点默认关闭，板级 dts 可 `okay` 覆盖 |

  

**关键点：**

- 会读 **内核源码中的 `Documentation/devicetree/bindings`**（或上游文档）核对属性是否合法。

- 理解 **dtsi 分层**：SoC 公版 `.dtsi` + 板级 `.dts` 覆盖/追加节点。

  

---

  

## 1.5 Linux 设备驱动（入门到进阶路径）

  

### 1.5.1 字符设备

  

- `cdev`、`file_operations`（open/read/write/ioctl/mmap/release）。

- 主次设备号、devtmpfs 与 `/dev` 节点。

  

### 1.5.2 平台与总线型驱动

  

- **platform_driver** + 设备树匹配。

- **I2C / SPI** 子系统：`i2c_client`、`spi_device`、核心 API。

  

### 1.5.3 并发与阻塞

  

- 等待队列 `wait_queue`；非阻塞与 `poll`；环形缓冲区与生产者消费者。

  

### 1.5.4 中断与下半部

  

- `request_irq`、threaded IRQ；tasklet（逐渐少用）、workqueue。

  

### 1.5.5 内存与 DMA

  

- `dma_alloc_coherent` / `dma_map_single`；**Cache 一致性**与 `dma_sync_*`。

  

### 1.5.6 常见子系统（按项目选学）

  

- **GPIO / Pinctrl**：管脚复用与电气属性。

- **Regulator**：供电使能与时序。

- **Clock**：时钟树、enable/disable、rate。

- **PWM、ADC（IIO）、RTC、Watchdog**。

  

**关键点：** 能独立写出一个 **最小字符设备 + sysfs 属性** 或 **GPIO 控制 LED** 的模块，并会 `insmod`/`dmesg` 调试。

  

---

  

## 1.6 启动流程（Boot Flow）

  

典型链（名称因芯片而异）：

  

1. **BootROM**：固化在芯片，从 SPI NOR / eMMC 等加载下一阶段。

2. **SPL / FSBL**：极小程序，初始化 DDR、最小时钟。

3. **U-Boot（或 Barebox）**：网络下载、环境变量、`bootcmd`、加载 **zImage/Image + dtb + initramfs（可选）**。

4. **Linux 内核**：解压、设备初始化、挂载 rootfs。

5. **init**：BusyBox init、systemd 或自定义。

  

**关键点：**

- `bootargs` / **内核命令行**：`console=`、`root=`、`rootfstype=`、`mem=`、`quiet` 等。

- **FIT image**、**A/B 分区**升级（了解工业与车载常见需求）。

  

---

  

## 1.7 交叉开发与工具链

  

| 概念 | 说明 |

|------|------|

| **Host / Target** | 在 x86 PC 上编译，在 ARM 板上运行 |

| **交叉编译器** | `aarch64-linux-gnu-gcc` 等；与目标 **libc（glibc/musl）**、**内核头版本** 要匹配 |

| **sysroot** | 目标根文件系统头文件与库的路径，供链接使用 |

| **ABI** | 调用约定、硬浮点 `hf`、EABI；**与内核、根文件系统一致** |

  

**关键点：** 能读懂 **工具链前缀** 与 **链接报错里缺哪个 .so**，会用 `readelf`、`file`、`ldd`（在目标板上）分析二进制。

  

---

  

## 1.8 根文件系统（rootfs）与初始化

  

- **目录结构**：FHS 常识（`/bin`、`/sbin`、`/etc`、`/lib`、`/usr`、`/var`、`/proc`、`/sys`、`/dev`）。

- **C 库**：glibc vs musl（体积、兼容性、许可证倾向）。

- **BusyBox**：常用 Unix 命令的集合，适合小 rootfs。

- **init**：PID 1 的职责；**inittab** 或 systemd unit（若用 systemd）。

- **库依赖**：动态链接时目标板需带齐 `.so` 或使用静态链接权衡。

  

**关键点：** 能用手工或 **Buildroot/Yocto** 打出能启动进 shell 的最小系统，并理解 **initramfs** 与真实 root 切换（若使用）。

  

---

  

## 1.9 构建系统（工程级必知）

  

| 系统 | 特点 | 适用 |

|------|------|------|

| **Buildroot** | Makefile/Kconfig，生成简单 rootfs+内核+U-Boot 配置，上手快 | 小到中型项目、快速出镜像 |

| **Yocto / OpenEmbedded** | 配方（recipe）、层（layer）、高度可复现 | 多产品变体、长期维护、大型团队 |

| **厂商 BSP** | 芯片商提供的整套 SDK | 先跑通再逐步替换/升级组件 |

  

**关键点：** 理解 **defconfig**、**package 选择**、**post-build 脚本**、**许可证合规**（见下文）。

  

---

  

## 1.10 存储与文件系统

  

| 介质 | 注意点 |

|------|--------|

| **Raw NAND** | 坏块、ECC、wear leveling；**UBI/UBIFS** 或 JFFS2（老） |

| **eMMC / SD** | 块设备；常见 **ext4**；注意掉电与 `fsync` |

| **SPI NOR** | 只读或读写分区；常放 kernel/dtb/小 rootfs |

| **分区与 GPT** | 分区表、A/B slot |

  

**关键点：** 理解 **只读 root + overlay** 或 **双分区回滚** 在量产中的价值。

  

---

  

## 1.11 调试手段（优先级从高到低建议掌握）

  

| 手段 | 用途 |

|------|------|

| **串口 console** | 最早期的内核 printk、shell |

| **dmesg / loglevel** | 驱动与内核子系统日志 |

| **/proc /sys** | 运行时状态、调参 |

| **gdbserver + 交叉 gdb** | 用户态单步 |

| **ftrace / perf（按需）** | 延迟与热点 |

| **JTAG/SWD** | 内核早期、裸机、死机分析（硬件依赖） |

| **kgdb、kdump（进阶）** | 内核崩溃与在线调试 |

  

**关键点：** 会配置 **earlyprintk** 与 **正确的 console=tty* 波特率**，能省大量「黑屏」时间。

  

---

  

## 1.12 实时与确定性（按需深入）

  

- 标准 Linux 为 **尽力而为** 调度；硬实时常需 **MCU 侧** 或 **RTOS 协处理器**。

- **PREEMPT_RT** 补丁：将部分不可抢占区缩短，改善延迟；需内核配置与验证。

- **关键点：** 用 **cyclictest** 等工具量化延迟，避免「感觉实时」。

  

---

  

## 1.13 网络与安全（现代产品常考）

  

- TCP/IP 基础、socket、iptables/nftables（若做网关）。

- **SSH**、**证书**、**OTA 签名**、**安全启动（Secure Boot）** 链：ROM → SPL → U-Boot → Kernel 验签思路。

- **Capabilities**、非 root 运行、最小权限。

- **CVE 与内核版本**：长期维护 LTS 内核的选择。

  

---

  

## 1.14 许可证与合规（不可忽视）

  

- **GPL**：内核模块与内核链接的衍生作品传播时的合规要求（简述：需能提供源码与构建说明，具体问法务）。

- **BusyBox、内核、U-Boot** 等许可证混用时的 **manifest** 与发布物检查。

  

---

  

## 1.15 推荐学习路径（可执行顺序）

  

1. **Shell + Makefile + Git**：能在命令行完成编辑、编译、版本管理。

2. **计算机组成 + ARM 体系结构入门**：MMU、异常、中断。

3. **应用交叉编译**：写 hello world，静态/动态链接各做一次，`readelf -h` 看懂 Machine。

4. **Buildroot 或厂商 BSP**：跑通串口 shell，会改 `bootargs`、换内核 dtb。

5. **设备树**：对照硬件原理图改一个 GPIO/LED 节点并验证。

6. **字符设备驱动**：内核模块 insmod，ioctl 或 sysfs 与用户态通信。

7. **I2C/SPI 传感器类驱动**（按硬件选）。

8. **Yocto 或更深层内核子系统**：按职业方向再分叉。

  

---

  

## 1.16 自检清单（「关键知识点」汇总）

  

用下面问题自测是否达到「初/中级嵌入式 Linux」常见要求：

  

- [ ] 说清从 **上电到 shell 提示符** 之间大致经过哪些软件阶段。

- [ ] 解释 **设备树里 compatible 与内核 probe** 如何对应。

- [ ] 说明 **中断上下文与进程上下文** 各能做什么、不能做什么。

- [ ] 配置并成功使用 **串口内核日志 + rootfs 挂载**。

- [ ] 独立完成 **交叉编译** 并在目标板运行，解决常见 **动态库缺失**。

- [ ] 使用 **Buildroot 或 Yocto** 之一生成过可启动镜像。

- [ ] 编写或修改过 **简单内核模块** 并理解 **许可证与导出符号**。

- [ ] 了解 **NAND 与 eMMC** 在文件系统选型上的差异。

- [ ] （选做）**PREEMPT_RT** 或延迟测试的基本概念。

  

---

  

## 1.17 延伸阅读与权威来源

  

- **内核文档**：内核源码树 `Documentation/`（设备树 bindings、驱动子系统）。

- **Bootloader**：U-Boot 官方文档（命令、FIT、DFU 等）。

- **书籍（经典向）**：*Linux Device Drivers*（LDD3 较老但思路仍有用）、*Running Linux*、体系结构侧 *ARM System Developer's Guide* 类教材。

- **社区**：kernel.org、各 SoC 厂商 wiki、ELinux.org。
