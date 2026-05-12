# 1 Linux 内核模块开发实战：从零到 sysfs

  

本文带你用**最小但完整**的路径完成一次可加载内核模块（LKM）的开发：能编译、能加载、能在 `dmesg` 里看到输出、能带**模块参数**，并在 `/sys/kernel` 下暴露一个**可读写**的 sysfs 属性。文中穿插嵌入式与通用驱动里反复出现的内核知识点；建议在 **与目标机一致或接近的内核版本** 上练习。


---

  

## 1.1 你将掌握什么

  

- 内核模块的**生命周期**：`module_init` / `module_exit` 与 `__init` / `__exit`。

- **Kbuild/Makefile** 如何调用内核构建系统产出 `.ko`。

- **`insmod` / `rmmod` / `modinfo` / `lsmod`** 与 **`dmesg`** 的配合。

- **模块元数据**：`MODULE_LICENSE`、`MODULE_DESCRIPTION` 等；**符号导出**与许可证的关系。

- **日志**：`printk` 级别、`pr_*` 辅助宏、**速率限制**日志。

- **返回值约定**：成功 `0`，失败负的 **`errno`**（如 `-ENOMEM`）。

- **动态内存**：`kmalloc` / `kfree` 与 **`GFP_*`** 标志的直觉。

- **sysfs**：`kobject` + `kobj_attribute` + `sysfs_create_group`，用户态用 `echo`/`cat` 与内核交互。

- **常见禁区**：睡眠上下文、原子上下文、模块卸载时资源必须释放干净。

  

---

  

## 1.2 环境准备

  

### 1.2.1 需要安装的组件（以 Debian/Ubuntu 为例）

  

- 与运行内核匹配的**头文件与构建依赖**：`linux-headers-$(uname -r)`、`build-essential`、`libncurses-dev` 等（发行版文档略有差异）。

- 若在**本机**加载模块：`uname -r` 输出的版本必须与 `make` 使用的 `-C /lib/modules/$(uname -r)/build` 一致。

  

### 1.2.2 若在另一台嵌入式目标上加载

  

- 使用目标机的 **kernel 源码树** 或厂商提供的 **SDK 里与镜像一致** 的 `KERNELDIR`，`ARCH`/`CROSS_COMPILE` 与编译内核时一致。

- 模块版本校验（**vermagic**）不一致时 `insmod` 会失败；需用**同一套配置编译的内核**构建模块。

  

---

  

## 1.3 实战一：Hello 模块（生命周期与构建）

  

### 1.3.1 知识点：入口、出口与段属性

  

- **`module_init(fn)`**：加载时调用 `fn`；返回 `0` 成功，返回负数失败并**不**注册模块（内核会清理）。

- **`module_exit(fn)`**：卸载时调用；必须能释放 `init` 里申请的一切资源。

- **`__init`**：初始化函数可放在「初始化内存段」，初始化结束后内核可丢弃该段代码（对模块仍要逻辑正确）。

- **`__exit`**：若内核配置为「不可卸载模块」，该段可能被丢弃；习惯上卸载路径仍写 `__exit`。

  

### 1.3.2 源码：`hello.c`

  

```c

// SPDX-License-Identifier: GPL-2.0

#include <linux/init.h>

#include <linux/module.h>

#include <linux/kernel.h>

  

static int __init hello_init(void)

{

pr_info("hello: loaded\n");

return 0;

}

  

static void __exit hello_exit(void)

{

pr_info("hello: unloaded\n");

}

  

module_init(hello_init);

module_exit(hello_exit);

  

MODULE_LICENSE("GPL");

MODULE_DESCRIPTION("Minimal hello LKM");

MODULE_AUTHOR("You");

```

  

### 1.3.3 知识点：`MODULE_LICENSE`

  

- 内核把许可证字符串用于**是否允许链接到仅导出给 GPL 的符号**等策略。

- 随意写 `"Proprietary"` 可能导致无法使用部分内核 API；学习阶段用 **`GPL`** 最省事。

  

### 1.3.4 Makefile（Kbuild 外环）

  

```makefile

obj-m += hello.o

  

KDIR ?= /lib/modules/$(shell uname -r)/build

  

all:

$(MAKE) -C $(KDIR) M=$(PWD) modules

  

clean:

$(MAKE) -C $(KDIR) M=$(PWD) clean

```

  

- **`obj-m`**：告诉内核构建系统「生成名为 `hello.ko` 的可加载模块」。

- **`M=$(PWD)`**：在外部目录编译（**out-of-tree**）。

  

### 1.3.5 编译与加载

  

```bash

make

sudo insmod hello.ko

dmesg | tail

sudo rmmod hello

dmesg | tail

```

  

### 1.3.6 知识点：`pr_info` 与 `printk`

  

- `pr_info` 等宏会带上默认 `KERN_*` 级别与 `pr_fmt` 可格式化前缀。

- `dmesg` 默认能看到 `INFO`；若环境提高了 `console_loglevel`，必要时用 `dmesg -w` 或调整 `/proc/sys/kernel/printk`。

  

---

  

## 1.4 实战二：模块参数（用户态可配置）

  

### 1.4.1 知识点：`module_param`

  

- 在 `insmod xxx.ko count=3` 或 `modprobe` 配置文件里传入。

- `MODULE_PARM_DESC` 给 `modinfo` 用，利于维护。

  

### 1.4.2 源码片段（可单独 `hello_param.c` 或合并练习）

  

```c

#include <linux/moduleparam.h>

  

static int count = 1;

module_param(count, int, 0644);

MODULE_PARM_DESC(count, "How many times to print on load");

  

static int __init hello_init(void)

{

int i;

  

if (count < 1 || count > 64)

return -EINVAL;

  

for (i = 0; i < count; i++)

pr_info("hello: ping %d/%d\n", i + 1, count);

return 0;

}

```

  

- 权限 **`0644`**：在 sysfs 的 `/sys/module/<name>/parameters/` 下可能以 root 可写方式暴露（取决于内核版本与安全策略）；**不要在生产里把敏感参数随便写成 world-writable**。

  

---

  

## 1.5 实战三：内存与错误处理（`kmalloc`）

  

### 1.5.1 知识点：`GFP_KERNEL` 与失败路径

  

- **`kmalloc(size, flags)`**：从物理近似连续、大小有上限的 slab 池取内存；失败返回 `NULL`。

- **`GFP_KERNEL`**：可能睡眠；**不可**在中断上下文或持有自旋锁时使用（需 `GFP_ATOMIC` 等，代价不同）。

- **配对**：每条成功 `kmalloc` 路径必须在 `module_exit` 或失败分支 `kfree`。

  

### 1.5.2 直觉表（够用版）

  

- 进程上下文、可睡眠：`GFP_KERNEL`。

- 原子上下文：`GFP_ATOMIC`（尽量少用大块）。

- DMA 连续物理页：另一套 API（`dma_alloc_coherent` 等），本文不展开。

  

### 1.5.3 模式：goto 清理（内核里常见且清晰）

  

```c

static char *buf;

static size_t buf_len = 128;

  

static int __init hello_init(void)

{

buf = kmalloc(buf_len, GFP_KERNEL);

if (!buf)

return -ENOMEM;

  

snprintf(buf, buf_len, "ok");

pr_info("hello: buf=%s\n", buf);

return 0;

}

  

static void __exit hello_exit(void)

{

kfree(buf);

buf = NULL;

}

```

  

---

  

## 1.6 实战四：sysfs 接口（与用户态交互）

  

### 1.6.1 知识点：kobject 与 attribute

  

- **`struct kobject`**：内核对象模型里用于引用计数与 sysfs 挂载点。

- **`struct kobj_attribute`**：把 `show`/`store` 回调挂到 sysfs 文件上。

- **`sysfs_create_group` / `sysfs_remove_group`**：成组创建/删除；**卸载模块前必须删除 sysfs**，否则残留 kobject 会导致卸载失败或不稳定。

  

### 1.6.2 行为约定

  

- **`show`**：用户 `cat` 时调用；用 `sprintf`/`scnprintf` 写入 `buf`，返回**写入的字节数**。

- **`store`**：用户 `echo xxx >` 时调用；注意 `count` 可能含换行；返回**实际消耗的字节数**或错误码（负 errno）。

  

### 1.6.3 完整示例：`hello_sysfs.c`

  

将下列文件与 Makefile 放在同一目录；Makefile 里把 `obj-m` 改成对应文件名（例如 `hello_sysfs.o`）。

  

```c

// SPDX-License-Identifier: GPL-2.0

#include <linux/init.h>

#include <linux/module.h>

#include <linux/kernel.h>

#include <linux/kobject.h>

#include <linux/sysfs.h>

#include <linux/string.h>

  

static struct kobject *demo_kobj;

static int demo_value;

  

static ssize_t value_show(struct kobject *kobj, struct kobj_attribute *attr,

char *buf)

{

return sprintf(buf, "%d\n", demo_value);

}

  

static ssize_t value_store(struct kobject *kobj, struct kobj_attribute *attr,

const char *buf, size_t count)

{

int ret, v;

  

ret = kstrtoint(buf, 0, &v);

if (ret < 0)

return ret;

  

demo_value = v;

return count;

}

  

static struct kobj_attribute value_attribute =

__ATTR(value, 0664, value_show, value_store);

  

static struct attribute *demo_attrs[] = {

&value_attribute.attr,

NULL,

};

  

static struct attribute_group demo_attr_group = {

.attrs = demo_attrs,

};

  

static int __init hello_sysfs_init(void)

{

int ret;

  

demo_kobj = kobject_create_and_add("hello_demo", kernel_kobj);

if (!demo_kobj)

return -ENOMEM;

  

ret = sysfs_create_group(demo_kobj, &demo_attr_group);

if (ret) {

kobject_put(demo_kobj);

demo_kobj = NULL;

return ret;

}

  

pr_info("hello_sysfs: see /sys/kernel/hello_demo/value\n");

return 0;

}

  

static void __exit hello_sysfs_exit(void)

{

if (demo_kobj) {

sysfs_remove_group(demo_kobj, &demo_attr_group);

kobject_put(demo_kobj);

demo_kobj = NULL;

}

}

  

module_init(hello_sysfs_init);

module_exit(hello_sysfs_exit);

  

MODULE_LICENSE("GPL");

MODULE_DESCRIPTION("LKM with sysfs demo");

MODULE_AUTHOR("You");

```

  

### 1.6.4 用户态验证

  

```bash

sudo insmod hello_sysfs.ko

cat /sys/kernel/hello_demo/value

echo 42 | sudo tee /sys/kernel/hello_demo/value

cat /sys/kernel/hello_demo/value

sudo rmmod hello_sysfs

```

  

---

  

## 1.7 Makefile（多目标时可切换 `obj-m`）

  

```makefile

obj-m += hello_sysfs.o

  

KDIR ?= /lib/modules/$(shell uname -r)/build

  

all:

$(MAKE) -C $(KDIR) M=$(PWD) modules

  

clean:

$(MAKE) -C $(KDIR) M=$(PWD) clean

```

  

---

  

## 1.8 调试与排障（建议现在就建立习惯）

  

### 1.8.1 `modinfo hello_sysfs.ko`

  

- 查看 `vermagic`、依赖、参数描述是否与预期一致。

  

### 1.8.2 Oops / panic 后

  

- 保留完整 `dmesg`；若有 vmlinux 与地址，可用 **`addr2line`** 把 PC 映射到源码行（进阶；先养成保存现场的习惯）。

  

### 1.8.3 速率限制日志

  

- 热路径里狂打日志会拖垮系统；可用 **`pr_info_ratelimited`** 等宏（头文件 `linux/printk.h`）。

  

---

  

## 1.9 与「驱动开发」衔接的关键概念（本实验已埋钩子）

  

### 1.9.1 睡眠与锁（直觉）

  

- **mutex**：进程上下文互斥；可睡眠。

- **spinlock**：禁止抢占/关本地中断的变体用于极短临界区；**持有自旋锁时不能睡眠**。

- 你在 `store` 里若调用可能睡眠的 API，要清楚当前是否允许（sysfs 的 `store` 一般在进程上下文，但仍避免长事务阻塞）。

  

### 1.9.2 `container_of`

  

- 字符设备、网络设备等结构里，常把 **`private_data`** 嵌在更大的 `struct my_drv` 里；通过 `container_of` 从子结构指针反推父结构。下一阶实战可写「最小 misc 字符设备」练习它。

  

### 1.9.3 模块卸载与引用计数

  

- 任何仍被打开的设备节点、未删除的 sysfs、未 `del_timer_sync` 的定时器，都可能导致**卸载后野指针**。本实验强调 **create/remove 对称** 是刻意训练。

  

---

  

## 1.10 自测清单（掌握标准）


- 能解释 **`insmod` 失败**时如何用 `dmesg` 与 `modinfo` 定位（vermagic、未解析符号、返回 `-EINVAL` 等）。

- 能说明 **`module_init` 失败**时内核是否会调用 `module_exit`（不会；因此 init 里失败要**手动释放**已申请资源）。

- 能说明 **`GFP_KERNEL` 与 `GFP_ATOMIC`** 的使用边界。

- 能独立把 sysfs 属性改成：只读、或带简单范围校验（例如拒绝负数）。

- 能口述：**为什么 `MODULE_LICENSE` 不是注释可有可无**。

  

---

  

## 1.11 常见错误

  

- **vermagic 不匹配**：换用目标机对应 `KDIR` 与工具链重编。

- **未导出符号**：链接阶段报错 `Unknown symbol`；需换 API、或内核配置打开依赖、或（在内核树内）`EXPORT_SYMBOL_GPL`（模块侧通常不该乱改内核导出表）。

- **sysfs 未删就 `rmmod`**：`sysfs_remove_group` / `kobject_put` 顺序与对称性错误。