---
tags:
  - C++
  - 嵌入式
title: 嵌入式 C++ 编译约束
description: -fno-exceptions、-fno-rtti、静态链接体积控制与嵌入式 C++ 编码规范
date: 2026/05/16
---

# 嵌入式 C++ 编译约束

在资源受限的嵌入式 Linux（或裸机）上使用 C++，需要主动裁剪 C++ 运行时的某些特性——不是因为 C++ 不好，而是那些特性的体积或运行时开销在嵌入式场景无法接受。

本文讲清楚**哪些选项该开、为什么开、开了之后代码要怎么改**。

---

## 1. 核心编译选项

| 选项 | 作用 | 典型节省 |
|------|------|----------|
| `-fno-exceptions` | 禁用 C++ 异常机制 | 减少 `libstdc++` 的异常处理代码，~50KB+ |
| `-fno-rtti` | 禁用 `dynamic_cast` 和 `typeid` | 减少 typeinfo 表，~10~50KB |
| `-ffunction-sections` | 每个函数放独立 section | 配合 gc-sections 按函数粒度剔除 |
| `-fdata-sections` | 每个全局变量放独立 section | 同上 |
| `-Wl,--gc-sections` | 链接时删除未引用的 section | 可减少 30~60% 体积 |
| `-Os` | 优化体积（比 `-O2` 体积小）| 视代码而定 |
| `-s` | strip 符号表 | 减少 50~80% 文件大小 |

### 1.1 典型 CMake 配置

```cmake
target_compile_options(myapp PRIVATE
    -fno-exceptions
    -fno-rtti
    -ffunction-sections
    -fdata-sections
    -Os
    -Wall -Wextra
)

target_link_options(myapp PRIVATE
    -Wl,--gc-sections
    -static   # 静态链接（可选，便于部署）
)
```

---

## 2. -fno-exceptions：禁用异常

### 2.1 为什么禁用

C++ 异常支持需要：
- **零开销表**（unwinding tables）：每个可能抛异常的函数都有，增加 `.eh_frame` section 体积
- **libsupc++**：异常处理运行时库
- **堆分配**：`throw` 时分配异常对象

即使你的代码从不用 `throw`，只要链接了带异常的库，就会引入这些开销。

### 2.2 禁用后的代码修改

禁用异常后，**所有构造函数里的错误都无法通过 throw 报告**，需要改用替代方案：

```cpp
// ❌ 依赖异常的构造（-fno-exceptions 下会触发 abort）
class Device {
public:
    Device(int fd) {
        if (fd < 0) throw std::runtime_error("invalid fd");  // 禁止！
        fd_ = fd;
    }
};

// ✅ 工厂函数 + optional
class Device {
public:
    static std::optional<Device> create(int fd) {
        if (fd < 0) return std::nullopt;
        return Device(fd);
    }
private:
    explicit Device(int fd) : fd_(fd) {}
    int fd_;
};

// 使用
auto dev = Device::create(open("/dev/ttyS0", O_RDWR));
if (!dev) {
    // 处理错误
    return -1;
}
```

**另一种模式：两步初始化**

```cpp
class Sensor {
public:
    Sensor() = default;
    bool init(const char *path) {
        fd_ = open(path, O_RDWR);
        return fd_ >= 0;
    }
    ~Sensor() { if (fd_ >= 0) close(fd_); }
private:
    int fd_ = -1;
};

Sensor s;
if (!s.init("/dev/i2c-1")) {
    return -1;
}
```

### 2.3 new 的行为变化

`-fno-exceptions` 下，`new` 失败**不会抛 `std::bad_alloc`**，而是直接返回 nullptr（行为类似 `new (std::nothrow)`）：

```cpp
// 必须检查 new 的返回值
auto *buf = new uint8_t[4096];
if (!buf) {
    // 内存不足
    return -1;
}
```

---

## 3. -fno-rtti：禁用运行时类型信息

RTTI 支持 `dynamic_cast` 和 `typeid`。禁用后：

```cpp
// ❌ 无法使用
Base *b = new Derived();
Derived *d = dynamic_cast<Derived*>(b);  // 链接失败或 abort

// ❌ 无法使用
std::cout << typeid(*b).name();

// ✅ 替代：用虚函数标识类型（如需多态行为）
class Base {
public:
    virtual bool is_derived() const { return false; }
};
class Derived : public Base {
public:
    bool is_derived() const override { return true; }
};
```

如果设计上根本不需要多态类型检查，禁用 RTTI 完全安全。

---

## 4. STL 使用注意

### 4.1 避免 iostream

```cpp
// ❌ iostream 体积大（尤其 std::cout 会拉入大量符号）
#include <iostream>
std::cout << "hello\n";

// ✅ 嵌入式日志用 printf 或轻量封装
#include <cstdio>
printf("hello\n");
```

`iostream` 在某些工具链上会增加 100KB~500KB 的链接体积。

### 4.2 容器选型

| 场景 | 推荐 | 避免 |
|------|------|------|
| 固定大小数组 | `std::array<T, N>` | `std::vector`（堆分配）|
| 少量动态数据 | `std::vector` + reserve | 频繁 push_back |
| 字符串处理 | `std::string_view`（读）| `std::string`（临时对象多）|
| 键值查找（小集合）| 线性查找 `std::array` | `std::unordered_map`（复杂内存分配）|

### 4.3 自定义分配器

嵌入式场景可以用 `pmr`（C++17 多态内存资源）替换堆分配：

```cpp
#include <memory_resource>
#include <vector>

// 用栈上的 buffer 而不是 heap
std::byte buf[4096];
std::pmr::monotonic_buffer_resource pool(buf, sizeof(buf));
std::pmr::vector<Packet> packets(&pool);  // 不调用 malloc
```

详见 [[编程语言/C++/PMR 与自定义分配器]]。

---

## 5. 体积检查工具

```bash
# 查看各 section 大小
size myapp
# 输出：
#   text    data     bss     dec     hex filename
# 123456    4096    2048  129600   1fa00 myapp

# 查看最大符号（找到体积大的函数/库）
nm --size-sort -r myapp | head -20

# 查看哪些库贡献了多少体积
arm-linux-gnueabihf-bloaty myapp -- myapp_stripped
```

---

## 6. 嵌入式 C++ 编码规范摘要

参考 **AUTOSAR C++ 14** 和 **JSF AV C++** 对嵌入式的限制：

| 规则 | 原因 |
|------|------|
| 禁止 `dynamic_cast` | 需要 RTTI，体积和性能开销 |
| 禁止 `typeid` | 同上 |
| 禁止异常跨模块边界 | ABI 不一致 |
| 构造函数只做简单初始化 | 不可抛异常 |
| 析构函数必须 `noexcept` | 已是 C++ 默认，但需明确保证 |
| 堆分配统一走自定义分配器 | 控制内存使用，避免碎片 |

---

## 延伸阅读

- [[编程语言/C++/RAII]]（`-fno-exceptions` 下的 RAII 替代）
- [[编程语言/C++/PMR 与自定义分配器]]（内存资源替代方案）
- [[编程语言/C++/C++ 封装 DPDK 数据面]]（数据面 C++ 约束）
- [[工程基础/MISRA C 与 CERT C 编码规范对照]]（编码规范）
