---
tags:
  - C++
  - 嵌入式
title: 嵌入式 C++ 编译约束
description: 异常、RTTI、fno-exceptions 与静态链接体积
date: 2026/05/16
---

# 嵌入式 C++ 编译约束

本文对应 [[成长路径/index|成长路径]] **中优先级**：在资源受限目标上 **裁剪 C++ 运行时**，避免无意引入 **异常 / RTTI** 开销。

---

## 常见编译选项

| 选项 | 作用 |
|------|------|
| `-fno-exceptions` | 禁用 C++ 异常（需代码无 throw） |
| `-fno-rtti` | 禁用 `dynamic_cast` / `typeid` |
| `-ffunction-sections -fdata-sections` + `--gc-sections` | 链接时剔除未用段 |
| `-Os` | 体积优化 |

---

## 异常替代

- 用 **`std::optional` / 错误码** 返回失败。
- 嵌入式框架（如部分 AUTOSAR 风格）禁止异常。

---

## STL 注意

- `iostream` 体积大，日志用 **printf** 或轻量库。
- 容器选型：固定容量 **`std::array`**、自定义 **arena allocator**。

---

## 与 DPDK

DPDK 多为 **C API**；C++ 封装见 [[编程语言/C++/C++ 封装 DPDK 数据面]]。

---

## 延伸阅读

- [[编程语言/C++/RAII]]
- [[编程语言/C++/C++11]]
