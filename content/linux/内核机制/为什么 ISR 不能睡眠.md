---
tags:
  - Linux
  - 中断
  - ISR
  - 驱动
title: 为什么 ISR 不能睡眠？
description: 硬中断上下文、睡眠语义、原子上下文与下半部分工
date: 2026/05/16
---

# 为什么 ISR 不能睡眠？

驱动开发里常听到：**硬中断处理函数（ISR / top half）里不能睡眠**。  
这句话是对的，但若只背结论，遇到 `mutex_lock`、`kmalloc(GFP_KERNEL)`、`copy_to_user` 仍会踩坑。

本文从 **「睡眠」在内核里指什么**、**ISR 运行在什么上下文**、**三条根本原因**、**违反后会发生什么**、**该把慢活放哪** 说清楚，并与 [[linux/学习路径/中断与下半部机制]]、[[linux/内核机制/内核同步机制总览]] 衔接。

---

## 1. 先界定：ISR 是什么

在 Linux 里，外设拉高 IRQ 线后，CPU 跳转到 **中断向量**，执行驱动注册的 **硬中断处理函数**（`request_irq` / `request_threaded_irq` 的 **hard handler**）。

```mermaid
flowchart LR
  HW[硬件 IRQ] --> CPU[CPU 进中断向量]
  CPU --> ISR[驱动 hard handler]
  ISR --> BH[tasklet / softirq / threaded / workqueue]
```

这一小段代码运行在 **硬中断上下文**（也称 **中断上下文**、**top half**），特点是：

- **抢占被关闭**（或处于「原子」临界区，视架构与配置而定）；
- **不是** 某个用户进程在跑，没有「可挂起的任务」语义；
- 应尽快返回，让系统继续收包、调度、处理其他 IRQ。

> **说明**：`threaded IRQ` 的 **thread_fn** 跑在内核线程里，**可以睡眠**；下文说的「ISR」特指 **硬中断 top half**。

---

## 2. 「睡眠」在内核里指什么

内核里的 **睡眠（blocking）** 不是 `sleep(3)` 那种用户态概念，而是：

> 当前执行路径 **主动或被动让出 CPU**，进入 **不可运行** 状态，直到某条件满足（锁可用、内存分配成功、IO 完成等）再由调度器 **重新选中**。

典型会睡眠的操作：

| 操作 | 为何会睡 |
|------|----------|
| `mutex_lock()` | 锁被占用时 **阻塞等待** |
| `down()` / `wait_event()` | 显式等待条件 |
| `kmalloc(GFP_KERNEL)` | 内存不足时可能 **直接回收 / 换页**，路径可阻塞 |
| `copy_to_user()` / `copy_from_user()` | 缺页时可能 **fault**，在进程上下文可处理，在中断里非法 |
| `msleep()` / `ssleep()` | 显式延时调度 |

与之相对，**不睡眠** 的同步包括：`spin_lock_irqsave()`、`local_irq_disable()`、原子操作等——忙等或关中断，**当前 CPU 一直占着这条执行流**。

内核用 **`might_sleep()`**、**`CONFIG_DEBUG_ATOMIC_SLEEP`** 在开发阶段检测：**在原子上下文里调用了可能睡眠的 API**。

---

## 3. 为什么 ISR 不能睡眠：三条根本原因

### 3.1 实时性与硬件契约：ISR 必须「短」

中断的含义是：**硬件有紧急事件**（FIFO 满、链路 down、定时器到点）。  
ISR 执行期间，往往：

- 该 IRQ 或同级中断 **可能被屏蔽**（或延迟响应）；
- 若处理太慢，**丢中断、FIFO 溢出、看门狗复位**。

若 ISR 里 `mutex_lock` 睡 10ms，等于这 10ms 内 **这条中断路径无法完成 ack / 读清状态**，对高速外设（网卡、DMA、编码器脉冲）可能是灾难。

**结论**：不是语法禁止，而是 **ISR 的职责** 决定了它应是 **微秒～几十微秒级** 的代码。

### 3.2 执行上下文不是「可调度任务」

进程上下文里睡眠时，调度器把当前 `task_struct` 标为 `TASK_INTERRUPTIBLE`，换别的任务跑，**栈和寄存器被保存**。

硬中断上下文 **没有绑定到普通任务栈上的可阻塞实体**：

- `current` 可能指向 **被中断打断的进程**，在 ISR 里睡眠会破坏其语义；
- 中断嵌套时栈与返回地址由 **中断帧** 管理，**不能** 像进程一样 `schedule()` 走一遍正常切换。

因此内核规定：在 **in_interrupt()** / **irqs_disabled()** 为真的路径上，调用会触发调度的函数属于 **非法**（`DEBUG_ATOMIC_SLEEP` 会报 *"Atomic context"*）。

```text
进程上下文     → 可以 schedule，可以睡眠
软中断/tasklet → 仍不可睡眠（in_softirq）
硬中断 ISR     → 不可睡眠
```

### 3.3 死锁与锁顺序

ISR 常与 **进程上下文**、**下半部** 共享数据。若 ISR 里拿 **mutex**（可睡眠）：

1. 进程 A 持 `mutex`，被 ISR 打断；
2. ISR 再申请同一 `mutex` → 永远等不到（A 已不会运行到释放）→ **死锁**。

所以 ISR 侧只能用 **spinlock**（或 **trylock** + 丢数据策略），且持锁时间极短。  
**spinlock 本身也不可睡眠**：睡眠会导致 **持锁 CPU 让出**，其他 CPU 自旋到死。

---

## 4. 一张表：ISR 里通常能做什么

| 操作 | ISR 中 | 说明 |
|------|--------|------|
| 读/写 MMIO 寄存器 | ✅ | 清中断、读 FIFO 水位 |
| `spin_lock_irqsave` | ✅ | 与进程/下半部共享数据 |
| `tasklet_schedule` / `schedule_work` | ✅ | 唤醒下半部 |
| `irq_wake_thread`（threaded IRQ） | ✅ | 唤醒中断线程 |
| `printk`（有限） | ⚠️ | 仍慢，生产慎用 |
| `mutex_lock` | ❌ | 可睡眠 |
| `kmalloc(GFP_KERNEL)` | ❌ | 可阻塞；可用 `GFP_ATOMIC`（不睡眠但易失败） |
| `copy_to_user` | ❌ | 可能 fault |
| `mdelay` / `msleep` | ❌ | 忙等也拉长关中断时间，禁止长 delay |

---

## 5. 违反了会怎样

- **开发内核**（`CONFIG_DEBUG_ATOMIC_SLEEP`）：`BUG: sleeping function called from invalid context`，栈回溯指向 `mutex_lock` 等。
- **未开调试**：可能 **偶发死锁**、**中断风暴**、**系统卡死**，难以复现。
- **长 busy-wait**（`udelay` 过大）：不等价于睡眠，但同样导致 **中断延迟** 与 **系统抖动**。

---

## 6. 慢逻辑应该放哪

原则：**ISR 只做「必须在中断里做」的最小集合**，其余延后。

| 机制 | 可睡眠 | 典型用途 |
|------|--------|----------|
| **tasklet / softirq** | 否 | 短、不可阻塞的延后处理 |
| **workqueue** | 是 | I2C/SPI 传输、`kmalloc`、通知用户态 |
| **threaded IRQ 的 thread_fn** | 是 | 新驱动常用，上半部只 ack |
| **专用 kthread** | 是 | 轮询、状态机 |

选用表见 [[linux/学习路径/中断与下半部机制]]。

**PREEMPT_RT** 会把部分中断 **线程化**，使 handler 在可抢占的内核线程里跑，从行为上 **允许在「中断线程」里睡眠**（配置与语义与普通 ISR 不同），见 [[linux/内核机制/PREEMPT_RT 与 cyclictest 入门]]。  
**不要** 把 RT 配置理解成「普通 `request_irq` 里可以随便 `mutex_lock`」。

---

## 7. 与「不能阻塞」相关的常见误区

**误区 1**：`kmalloc(GFP_ATOMIC)` 在中断里就安全。  
→ 不睡眠，但 **可能失败**；不能大块、高频分配，应 **预分配池**。

**误区 2**：`spin_lock` 在 ISR 里可以很久。  
→ 不睡眠，但 **关抢占/中断** 期间其他 CPU 可能自旋，拖垮系统。

**误区 3**：`printk` 在中断里随便打。  
→ 可能走串口锁、控制台锁，**极慢**，高频率 IRQ 下会拖死。

**误区 4**：软中断里可以 `mutex_lock`。  
→ **tasklet / softirq 仍不可睡眠**，规则与 ISR 类似，只是延迟执行。

---

## 8. 驱动里的一条实践口诀

```text
ISR：ack + 取数 + 调度下半部（spinlock 内极短）
下半部 / 工作队列 / 中断线程：协议、总线、内存、用户态
```

写代码前自问：

1. 这段逻辑 **延迟 1ms** 硬件还能接受吗？不能 → 别放 ISR。
2. 会不会 **等锁 / 等内存 / 等 IO**？会 → 别放 ISR。
3. 与进程是否 **共锁**？是 → ISR 侧只用 spinlock + 短临界区。

---

## 9. 小结

| 问题 | 答案 |
|------|------|
| ISR 为什么不能睡眠？ | **硬件要快**、**上下文不可 schedule**、**与进程锁会死锁** |
| 「睡眠」指什么？ | 让出 CPU 并阻塞等待，如 mutex、GFP_KERNEL、显式 wait |
| 慢代码放哪？ | workqueue、threaded IRQ、kthread |
| 如何自查？ | 开 `DEBUG_ATOMIC_SLEEP`，禁止 ISR 里 mutex/msleep/长 printk |

---

## 延伸阅读

- [[linux/学习路径/中断与下半部机制]] — tasklet / workqueue / threaded IRQ 选用
- [[linux/内核机制/内核同步机制总览]] — spinlock vs mutex 与上下文
- [[linux/概览/嵌入式Linux基础知识]] — 脚注中的上下文对照
- [[linux/内核机制/进程调度与绑核]] — 中断 affinity 与 DPDK 绑核
- [[linux/内核机制/DMA 与 Cache 一致性入门]] — 中断里启动 DMA 的注意点
