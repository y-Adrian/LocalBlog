---
tags:
  - Linux
  - 驱动
  - sysfs
title: sysfs 与 proc 调试接口
description: 模块参数、debugfs、dynamic debug 与用户态读写调试节点
date: 2026/05/16
---
%%  %%
# 1 sysfs 与 proc 调试接口

本文对应 [[成长路径/index|成长路径]] **高优先级**：为驱动暴露 **模块参数** 与 **sysfs/debugfs** 节点，便于现场调试。

---

## 1.1 学习目标

- 使用 `module_param` 在加载时调参。
- 在 **sysfs** 或 **debugfs** 下创建 **属性文件**。
- 理解 **show/store** 回调与 **缓冲区大小** 限制。

---

## 1.2 模块参数

```c
static int debug_level = 0;
module_param(debug_level, int, 0644);
MODULE_PARM_DESC(debug_level, "0=off, 1=verbose");
```

```bash
insmod mymod.ko debug_level=2
cat /sys/module/mymod/parameters/debug_level
echo 1 | sudo tee /sys/module/mymod/parameters/debug_level
```

适合 **开关、采样周期** 等简单整型/布尔参数。

---

## 1.3 sysfs 属性（device_attribute）

挂在 **device** 或 **driver** 上：

```c
static ssize_t reg_show(struct device *dev, struct device_attribute *attr, char *buf)
{
    return sysfs_emit(buf, "0x%08x\n", readl(priv->base + OFF_VER));
}

static ssize_t reg_store(struct device *dev, struct device_attribute *attr,
                         const char *buf, size_t count)
{
    unsigned long val;
    if (kstrtoul(buf, 0, &val))
        return -EINVAL;
    writel(val, priv->base + OFF_CTRL);
    return count;
}

static DEVICE_ATTR_RW(reg);

/* probe 中 */
device_create_file(&pdev->dev, &dev_attr_reg);
/* remove 中 */
device_remove_file(&pdev->dev, &dev_attr_reg);
```

或使用 `devm_device_add_group` + `attribute_group` 批量注册。

---

## 1.4 debugfs（内核调试）

```c
#include <linux/debugfs.h>
struct dentry *dent;

dent = debugfs_create_dir("mydev", NULL);
debugfs_create_u32("stats", 0644, dent, &priv->stats);
```

路径常为 `/sys/kernel/debug/mydev/stats`（需挂载 debugfs）。

**生产镜像** 可关闭 `CONFIG_DEBUG_FS` 减小攻击面。

---

## 1.5 Dynamic Debug（dynamic_debug）

**动态调试（dynamic debug）** 让你在 **不重新编译模块** 的前提下，按 **文件 / 函数 / 模块 / 行号** 开关内核里的 `pr_debug()`、`dev_dbg()` 输出。RISC-V 板级实操见 [[riscv-驱动开发日志/2026-05-31 — 创建字符设备文件#4. Dynamic Debug 实践（本篇重点）]]。

### 1.5.1 读完能带走什么

- 知道驱动里应优先用 `pr_debug` 而不是注释掉的 `printk`。  
- 会用 `/sys/kernel/debug/dynamic_debug/control` 做 `+p` / `-p`。  
- 能判断 **目标内核** 是否支持（`CONFIG_DYNAMIC_DEBUG`）。

### 1.5.2 机制概览

```mermaid
flowchart LR
  BUILD[编译期 pr_debug 展开]
  BUILD --> SEC[ELF section __verbose 描述符表]
  SEC --> RUN[运行期默认 flags 关]
  RUN --> DFS[写 debugfs control]
  DFS --> ON[flags 置 PRINT 位]
  ON --> OUT[dmesg 输出]
```

| 阶段 | 发生什么 |
|------|----------|
| **编译期** | 每处 `pr_debug()` 生成一个 `_ddebug` 描述符（模块名、文件名、函数、行号、flags），链入 `__verbose` 段；**代码路径保留**，默认 `flags` 不含 print 位 → 一次 `if` 跳过，开销极小 |
| **加载模块** | 描述符注册进内核全局 dynamic debug 表 |
| **运行期** | 向 `control` 写入查询 + 操作，内核匹配条目并改 `flags`；匹配项上的 `pr_debug` 开始调用 `printk` |

`pr_debug` 在头文件里大致分三种命运（取决于 **编译所用内核配置**）：

```c
#if defined(CONFIG_DYNAMIC_DEBUG)
    #define pr_debug(fmt, ...) dynamic_pr_debug(fmt, ##__VA_ARGS__)
#elif defined(DEBUG)
    #define pr_debug(fmt, ...) printk(KERN_DEBUG pr_fmt(fmt), ##__VA_ARGS__)
#else
    #define pr_debug(fmt, ...) no_printk(fmt, ##__VA_ARGS__)
#endif
```

### 1.5.3 常用命令

```bash
# 挂载 debugfs（多数桌面/开发镜像已挂；嵌入式需 CONFIG_DEBUG_FS）
mount -t debugfs none /sys/kernel/debug

# 按源文件打开
echo 'file mydriver.c +p' > /sys/kernel/debug/dynamic_debug/control

# 按函数 / 模块 / 行号
echo 'func probe_one +p' > /sys/kernel/debug/dynamic_debug/control
echo 'module mymod +p' > /sys/kernel/debug/dynamic_debug/control
echo 'line mydriver.c:100-120 +p' > /sys/kernel/debug/dynamic_debug/control

# 关闭
echo 'file mydriver.c -p' > /sys/kernel/debug/dynamic_debug/control

# 查看状态：=p 已开，=_ 关闭
cat /sys/kernel/debug/dynamic_debug/control | grep mymod
```

**板级示例**（`debris` 模块）：

```bash
echo 'file debris_fops.c +p' > /sys/kernel/debug/dynamic_debug/control
cat /dev/debris_kernel
dmesg | tail
```

### 1.5.4 与 `#ifdef DEBUG`、module_param 对比

| 方式 | 开关时机 | 粒度 | 生产内核常用 |
|------|----------|------|--------------|
| `#ifdef DEBUG` + `printk` | 编译期 | 整模块 | 否（需重编） |
| `module_param(debug_level)` | 运行期 | 模块内自定义级别 | 是 |
| **dynamic debug** | 运行期 | **精确到行** | 是（需内核支持） |
| 自建 debugfs 节点 | 运行期 | 自定义 | 是 |

**面试一句**：dynamic debug 把「是否打印」从编译期挪到运行期，靠描述符表 + debugfs，适合 **现场排障**；高频路径仍应用 `pr_debug` 而非永久打开的 `printk`。

### 1.5.5 何时不可用

须同时满足：

1. **内核** `CONFIG_DYNAMIC_DEBUG=y`（查 `/proc/config.gz` 或 `/boot/config-$(uname -r)`）。  
2. **debugfs** 可用（`CONFIG_DEBUG_FS=y`，且已挂载）。  
3. **模块** 是针对该内核树编译的——若内核打开 dynamic debug，out-of-tree 模块里的 `pr_debug` 会生成描述符；若内核未开，驱动侧 `pr_debug` 被编译成 **空操作**，`control` 里也 **搜不到** 对应条目。

Release 厂商内核常关闭 `CONFIG_DYNAMIC_DEBUG`：此时只能依赖 `printk` 级别、`module_param` 或自建 debugfs，不能指望 `echo ... +p`。

### 1.5.6 驱动写法建议

```c
#include <linux/module.h>
#include <linux/device.h>

/* 字符设备 / 平台驱动 */
static ssize_t debris_read(struct file *filp, char __user *buf, size_t len, loff_t *ppos)
{
    pr_debug("debris: read len=%zu\n", len);   /* 默认静默，dynamic debug 可开 */
    ...
}

/* 有 struct device 时优先 dev_dbg，便于按设备过滤 */
dev_dbg(dev, "probe ok, irq=%d\n", irq);
```

- 永久需要的信息：`dev_info` / `dev_err`。  
- 调试用、可能刷屏：`pr_debug` / `dev_dbg`。  
- 与 [[系统调试/排障 SOP：日志、perf 与反汇编]] 中「先加日志」步骤衔接。

---

## 1.6 procfs（旧接口）

`/proc/mydev` 仍见于老驱动；新代码优先 **sysfs / debugfs**。只读信息可用 `seq_file` 简化。

---

## 1.7 与用户态工具

| 操作 | 示例 |
|------|------|
| 读寄存器 | `cat /sys/.../reg` |
| 写控制位 | `echo 1 > /sys/.../reset` |
| 开 pr_debug | `echo 'file foo.c +p' > /sys/kernel/debug/dynamic_debug/control` |
| 脚本批量 | `ssh` + `tee` |

配合 [[linux/驱动与模块/Linux 内核模块开发实战]] 中的 sysfs 实验。

---

## 1.8 安全注意

- **store** 中校验范围，避免写坏硬件。
- 量产后移除或 **chmod** 限制写权限。
- 勿在 **store** 中睡眠过久或持锁过久。

---

## 1.9 实践清单

- [ ] 为 demo 驱动增加 **只读版本号** 与 **可写复位** 属性
- [ ] 用 `module_param` 控制日志级别
- [ ] 用 **dynamic debug** 开关 `pr_debug`（见 [[riscv-驱动开发日志/2026-05-31 — 创建字符设备文件]]）
- [ ] 确认 `rmmod` 后 sysfs 节点已删除

---

## 1.10 延伸阅读

- [[linux/驱动与模块/platform 驱动完整案例]]
- [[系统调试/排障工具链一张图]]
