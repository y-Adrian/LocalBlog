---
tags:
  - Linux
  - 驱动
  - 电源
title: Runtime PM 与休眠唤醒入门
description: runtime_pm、系统休眠与驱动 suspend resume
date: 2026/05/16
---

# Runtime PM 与休眠唤醒入门

本文对应 [[成长路径/index|成长路径]] **中优先级**：按硬件支持配置 **运行时省电** 与 **系统休眠**。

---

## Runtime PM

设备空闲时 **clock off / 电源域关闭**：

```c
pm_runtime_enable(&pdev->dev);
pm_runtime_get_sync(&pdev->dev);  /* 使用前 */
/* 访问硬件 */
pm_runtime_put(&pdev->dev);     /* 空闲 */
```

驱动需实现 **`runtime_suspend` / `runtime_resume`**。

---

## 系统休眠（mem）

| 状态 | 说明 |
|------|------|
| **freeze** | 用户态冻结 |
| **mem** | 挂起到 RAM |
| **disk** | 休眠到磁盘 |

驱动实现 **`suspend` / `resume`** 或 **`suspend_noirq`** 等。

---

## 设备树

```dts
wake-parent = <&gpio>;
wakeup-source;
```

GPIO **唤醒源** 需在 BSP 中配置 **irq wake**。

---

## 调试

```bash
cat /sys/power/state
echo mem > /sys/power/state   # 需 root，确认硬件支持
```

失败时查 **dmesg** 哪个设备 **suspend 失败**。

---

## 延伸阅读

- [[linux/驱动与模块/platform 驱动完整案例]]
- [[linux/学习路径/设备树实战指南]]
