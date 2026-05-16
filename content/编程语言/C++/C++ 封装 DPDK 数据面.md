---
tags:
  - C++
  - DPDK
title: C++ 封装 DPDK 数据面
description: 对象池、rte_ring 与零拷贝接口设计
date: 2026/05/16
---

# C++ 封装 DPDK 数据面

本文对应 [[成长路径/index|成长路径]] **中优先级**：在 **C API** 之上用 C++ 组织 **生命周期清晰** 的数据面，而不隐藏 DPDK 并发假设。

---

## 设计原则

1. **构造/析构** 对应 `rte_eal_init` / `rte_eal_cleanup` 作用域（单例谨慎）。
2. ** mbuf 所有权** 明确：谁 alloc、谁 free，**禁止 double free**。
3. **per-lcore 对象** 不放共享 `std::vector` 无锁写。

---

## 薄封装示例（概念）

```cpp
class MbufPtr {
  rte_mbuf* m_{};
public:
  explicit MbufPtr(rte_mbuf* m) : m_(m) {}
  ~MbufPtr() { if (m_) rte_pktmbuf_free(m_); }
  MbufPtr(const MbufPtr&) = delete;
  rte_mbuf* get() const { return m_; }
};
```

---

## rte_ring 队列

- 用 **SP/SC** 标志匹配实际并发，见 [[网络与DPDK/实践/多 worker 与 mempool 并发假设]]。
- C++ 侧可用 **模板包装** `enqueue`/`dequeue`，不在环内 `new`。

---

## 零拷贝边界

- 报文数据在 **mbuf** 内；向业务层暴露 **`string_view`** 只读视图，**不** 在回调里 `std::string` 拷贝大包。
- 需要修改时 **克隆 mbuf** 或池内分配新包。

---

## 延伸阅读

- [[编程语言/C++/无锁编程]]
- [[网络与DPDK/实践/最小数据面项目设计]]
