---
tags:
  - Linux
  - 驱动
  - sysfs
title: sysfs 与 proc 调试接口
description: 模块参数、debugfs 与用户态读写调试节点
date: 2026/05/16
---

# sysfs 与 proc 调试接口

本文对应 [[成长路径/index|成长路径]] **高优先级**：为驱动暴露 **模块参数** 与 **sysfs/debugfs** 节点，便于现场调试。

---

## 学习目标

- 使用 **`module_param`** 在加载时调参。
- 在 **sysfs** 或 **debugfs** 下创建 **属性文件**。
- 理解 **show/store** 回调与 **缓冲区大小** 限制。

---

## 模块参数

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

## sysfs 属性（device_attribute）

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

或使用 **`devm_device_add_group`** + `attribute_group` 批量注册。

---

## debugfs（内核调试）

```c
#include <linux/debugfs.h>
struct dentry *dent;

dent = debugfs_create_dir("mydev", NULL);
debugfs_create_u32("stats", 0644, dent, &priv->stats);
```

路径常为 **`/sys/kernel/debug/mydev/stats`**（需挂载 debugfs）。

**生产镜像** 可关闭 `CONFIG_DEBUG_FS` 减小攻击面。

---

## procfs（旧接口）

`/proc/mydev` 仍见于老驱动；新代码优先 **sysfs / debugfs**。只读信息可用 **`seq_file`** 简化。

---

## 与用户态工具

| 操作 | 示例 |
|------|------|
| 读寄存器 | `cat /sys/.../reg` |
| 写控制位 | `echo 1 > /sys/.../reset` |
| 脚本批量 | `ssh` + `tee` |

配合 [[linux/驱动与模块/Linux 内核模块开发实战]] 中的 sysfs 实验。

---

## 安全注意

- **store** 中校验范围，避免写坏硬件。
- 量产后移除或 **chmod** 限制写权限。
- 勿在 **store** 中睡眠过久或持锁过久。

---

## 实践清单

- [ ] 为 demo 驱动增加 **只读版本号** 与 **可写复位** 属性
- [ ] 用 `module_param` 控制日志级别
- [ ] 确认 `rmmod` 后 sysfs 节点已删除

---

## 延伸阅读

- [[linux/驱动与模块/platform 驱动完整案例]]
- [[系统调试/排障工具链一张图]]
