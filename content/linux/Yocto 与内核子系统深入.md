---
tags:
  - Linux
  - 嵌入式
  - 学习路径
title: Yocto 与内核子系统深入
description: 发行版工程化与按职业方向分叉——网络、存储、调度
---

# Yocto 与内核子系统深入

本文是 **嵌入式 Linux 学习路径** 第八阶段：在能 **Buildroot 跑通、会写简单驱动** 之后，按职业方向 **分叉**——要么掌握 **Yocto/OpenEmbedded** 做 **可复现、多 SKU 产品化**；要么深入 **内核子系统**（**网络、存储、调度** 等）。二者可并行，但建议 **先选一个主战场** 做深。

---

## 学习目标（Yocto 线）

- 理解 **layer、recipe、bbappend、IMAGE、PACKAGE** 关系。
- 能 **bitbake core-image-minimal**（或厂商 layer）并 **修改 recipe 打补丁**。
- 使用 **SDK**（`populate_sdk`）做应用交叉编译，与 **应用交叉编译** 阶段衔接。

---

## 学习目标（内核子系统线）

- 选定 **一个方向**（网络 / 块存储与 FS / 调度与实时），能 **读源码 + trace + 文档** 独立排查一类问题。
- 理解 **子系统与 VFS/块层/netlink** 的边界，不「全会但全浅」。

---

## 第一部分：Yocto / OpenEmbedded

### 为何在 Buildroot 之后学 Yocto

| | **Buildroot** | **Yocto** |
|---|---------------|-----------|
| 学习曲线 | 较陡但路径短 | 更陡，概念多 |
| 多产品变体 | 可行 | **layer 复用** 更强 |
| 包生态 | 够用 | **OE-Core + meta-* 丰富** |
| 可复现性 | 好 | **强调 hash、license、CVE 流程** |

### 核心概念

- **Layer**：配方与配置的集合；**`BBPATH`** 搜索路径。
- **Recipe（`.bb`）**：描述如何 **fetch、patch、configure、compile、install、package**。
- **bbappend（`.bbappend`）**：在不改上游 recipe 的情况下 **追加** 配置或补丁。
- **Machine**：板级配置（内核 defconfig、dtb、 tune）。
- **Distro**：发行版策略（systemd/musl、特性开关）。
- **Image recipe**：哪些 **IMAGE_INSTALL** 包进入 rootfs。

### 最小工作流

```bash
git clone git://git.yoctoproject.org/poky
cd poky
source oe-init-build-env build
bitbake core-image-minimal
# 输出在 tmp/deploy/images/<machine>/
```

### 常用命令

```bash
bitbake -c compile virtual/kernel -f   # 强制重编内核
bitbake-layers show-layers
devtool modify busybox                  # 工作区改 recipe
bitbake core-image-minimal -c populate_sdk
```

### 实践练习

- [ ] 新建 **meta-custom** layer，**bbappend** 增加一个 **hello** 包到 image。
- [ ] 给内核 **打 dtb 补丁** 通过 **bbappend** 而非手改 `tmp/`。
- [ ] 生成 **SDK** 并用 **`environment-setup-*`** 交叉编译应用。

### 常见坑

- 在 **`tmp/`** 手改文件 — **下次 bitbake 覆盖**；改 **recipe 或 bbappend**。
- **`MACHINE`** 与 **`DISTRO`** 选错导致 **boot 失败**。
- **LICENSE 闭源包** 与 **GPL 传播** 合规未审查。

---

## 第二部分：内核子系统分叉指南

### 网络方向（网关、DPDK 对照、协议栈）

**应掌握**

- **`sk_buff`** 生命周期、**net_device**、**NAPI**。
- **socket 层** 到 **驱动** 路径；**ethtool**、**RSS**（与 DPDK 教程对照）。
- **iptables/nftables**、**network namespace**（容器/虚拟化）。

**阅读入口**

- **`net/core/`**、**`net/ipv4/`**、驱动 **`drivers/net/`**
- **Documentation/networking/**

**实践**

- **`tcpdump`**、**`ss`**、**`ip route`** 在板端排障；
- 跟踪 **`ping` 一次** 的 kernel 路径（**ftrace**）。

---

### 存储方向（工业、车载、NAS 边缘）

**应掌握**

- **VFS → 具体 FS（ext4/f2fs）→ 块层 → 驱动**；
- **MTD/UBI/UBIFS** vs **eMMC + ext4**（见本站 **存储与 IO**）；
- **Direct IO、缓存、fsync** 语义；**分区与 GPT**。

**阅读入口**

- **`fs/ext4/`**、**`block/`**、**`drivers/mmc/`**
- **Documentation/filesystems/**

**实践**

- 人为 **掉电测试** ext4 vs ubifs 行为差异（**实验环境**）；
- **`iostat`**、**`/proc/diskstats`** 关联应用写入模式。

---

### 调度与实时方向（工控、音频、机器人 Linux）

**应掌握**

- **CFS** 基本概念、**nice**、**cgroup cpu**；
- **PREEMPT_RT** 配置与 **cyclictest**；
- **中断线程化**、**priority inversion** 直觉。

**阅读入口**

- **`kernel/sched/`**
- **Documentation/admin-guide/cgroup-v2.rst**

**实践**

- **绑核** + **cyclictest** 对比 **PREEMPT 开/关**；
- 用 **ftrace latency tracers** 看 **调度延迟**。

---

## 如何选择主战场（诚实建议）

| 你日常工作更接近 | 优先深入 |
|------------------|----------|
| 网通、网关、WiFi/BT 模块 | **网络** + 用户态 **epoll/io_uring** |
| 存储产品、工控记录、摄像头录像 | **存储 + VFS** |
| 运动控制、PLC 类 Linux | **调度 + RT + 驱动 IRQ** |
| 多硬件 SKU、长期维护发行版 | **Yocto** 为主，子系统按需 |

---

## 阶段验收（Yocto）

- [ ] 画出 **bitbake 任务依赖** 直觉图（fetch → unpack → patch → configure → compile → install → package → rootfs）。
- [ ] 独立 **bbappend** 一个补丁并 **升级版本不丢改动**（用 layer 而非 tmp）。

## 阶段验收（子系统，任选一）

- [ ] **网络**：说清 **一次 UDP recvfrom** 到驱动的层级。
- [ ] **存储**：说清 **`write()` 到 eMMC** 经过哪些缓存层。
- [ ] **调度**：解释 **CFS vruntime** 一句话 + **为何 RT 任务还需绑核**。

---

## 与全路径的闭环

完成八阶段后，你应具备：

- **工程底座**：Shell/Make/Git → 交叉编译 → Buildroot/Yocto。
- **硬件软件接口**：体系结构 → DT → 驱动（字符 / 总线）。
- **产品化与深度**：镜像供应链 + 一条内核子系统深水区。

---

## 参考

- **Yocto Project Documentation**（Mega-Manual）
- **OpenEmbedded Layer Index**
- 本站：**存储与 IO**、**DPDK 系列**、**cgroup**、**上下文切换** 等专题文

---

*内核子系统「全栈精通」不现实；用 **一个问题驱动一次源码阅读** 积累深度。*
