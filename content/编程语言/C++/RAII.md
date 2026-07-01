---
title: RAII
date: 2026/05/11
description: Resource Acquisition Is Initialization——C++ 中最重要的资源管理惯用法
---

# RAII

> **一句话**：资源的生命周期绑定到对象的生命周期。对象构造时获取资源，对象析构时释放资源，不论退出路径是正常 return 还是异常。

---

## 1. 为什么需要 RAII

C 语言里的资源管理是**手动**的，充满陷阱：

```c
FILE *fp = fopen("data.txt", "r");
if (!fp) return -1;

int *buf = malloc(1024);
if (!buf) {
    fclose(fp);   // 必须手动清理 fp
    return -1;
}

// ... 复杂逻辑，有多个 return 路径 ...

free(buf);
fclose(fp);       // 万一忘了怎么办？
```

在 C++ 里，当函数因**异常**或**提前 return** 而退出时，手动释放语句可能根本不会执行——这就是资源泄漏。

**RAII 的解法**：把"释放操作"放进析构函数，当对象离开作用域时**自动执行**，无论通过什么路径退出。

---

## 2. RAII 的基本模式

```cpp
class FileGuard {
public:
    explicit FileGuard(const char *path)
        : fp_(fopen(path, "r")) {
        if (!fp_) throw std::runtime_error("cannot open file");
    }

    ~FileGuard() {
        if (fp_) fclose(fp_);   // 析构时保证释放
    }

    // 禁止拷贝（资源不能共享所有权）
    FileGuard(const FileGuard&) = delete;
    FileGuard& operator=(const FileGuard&) = delete;

    // 允许移动（所有权转移）
    FileGuard(FileGuard&& o) noexcept : fp_(o.fp_) { o.fp_ = nullptr; }

    FILE* get() const { return fp_; }

private:
    FILE *fp_;
};

void process() {
    FileGuard f("data.txt");   // 构造时打开
    // ... 使用 f.get() 读文件 ...
    // 不需要手动 fclose
}   // ← fclose 在这里自动执行，不管是正常 return 还是异常
```

---

## 3. 标准库里的 RAII 容器

不需要自己写，标准库已经提供了所有常用场景：

| 资源类型 | RAII 封装 | 说明 |
|----------|-----------|------|
| 堆内存（独占） | `std::unique_ptr<T>` | 离开作用域自动 `delete` |
| 堆内存（共享） | `std::shared_ptr<T>` | 引用计数归零时 `delete` |
| 互斥锁 | `std::lock_guard<Mutex>` | 离开作用域自动 `unlock` |
| 互斥锁（更灵活） | `std::unique_lock<Mutex>` | 支持条件变量、提前解锁 |
| 文件句柄 | `std::fstream` | 析构时自动 `close` |
| 线程 | `std::jthread`（C++20） | 析构时自动 `join` |

### 3.1 `unique_ptr`：最常用的堆内存 RAII

```cpp
// ❌ 裸指针：容易泄漏
Widget *w = new Widget();
process(w);     // 如果 process 抛异常 → delete 不执行 → 泄漏！
delete w;

// ✅ unique_ptr：不管什么情况都会 delete
auto w = std::make_unique<Widget>();
process(*w);    // 异常? 返回? 都没问题，离开作用域自动释放
```

### 3.2 `lock_guard`：锁的 RAII

```cpp
std::mutex mtx;

void update_shared_data() {
    std::lock_guard<std::mutex> lock(mtx);  // 构造时 lock()
    shared_data += 1;
    // ... 多个 return 路径都没问题 ...
}   // ← lock 析构时自动 unlock()
```

### 3.3 自定义 deleter：管理 C 库资源

当第三方库有特殊释放函数时，给 `unique_ptr` 指定 deleter：

```cpp
// 管理 OpenSSL 的 EVP_MD_CTX
using EvpCtxPtr = std::unique_ptr<EVP_MD_CTX, decltype(&EVP_MD_CTX_free)>;

EvpCtxPtr ctx(EVP_MD_CTX_new(), EVP_MD_CTX_free);
// ctx 离开作用域时，自动调用 EVP_MD_CTX_free(ctx.get())
```

---

## 4. 异常安全等级

RAII 是实现异常安全的基础。C++ 定义了三个安全等级：

| 等级 | 含义 | 如何实现 |
|------|------|----------|
| **基本保证** | 异常后对象仍处于有效状态（但值可能变了） | 用 RAII 持有所有资源，失败时自动回滚 |
| **强保证** | 异常后状态完全不变（如同操作未发生） | Copy-and-swap 惯用法 |
| **无抛出保证** | 保证不抛异常 | `noexcept` 函数、析构函数 |

**析构函数必须 `noexcept`**（默认如此）——析构时再抛异常会调用 `std::terminate()`。

---

## 5. 常见陷阱

### 5.1 裸 new/delete 配对遗漏

```cpp
// ❌ 危险：容易泄漏，或异常路径跳过 delete
Foo *p = new Foo();
if (some_condition()) return;  // 泄漏！
delete p;

// ✅ 总是用 make_unique
auto p = std::make_unique<Foo>();
```

### 5.2 不该手动管理数组

```cpp
// ❌ 数组版 delete 容易用错
Foo *arr = new Foo[10];
delete arr;   // UB！应该是 delete[] arr

// ✅ 用 vector 或 unique_ptr<T[]>
std::vector<Foo> arr(10);
auto arr2 = std::make_unique<Foo[]>(10);
```

### 5.3 循环引用导致 `shared_ptr` 不释放

```cpp
struct Node {
    std::shared_ptr<Node> next;
    std::shared_ptr<Node> prev;  // 双向链表 → 循环引用 → 永不释放！
};
// 解决：其中一个方向改用 std::weak_ptr
```

### 5.4 在析构里调用虚函数

```cpp
class Base {
public:
    virtual ~Base() {
        cleanup();   // ❌ 此时 derived 已被析构，调用的是 Base::cleanup
    }
    virtual void cleanup() {}
};
```

---

## 6. RAII 与嵌入式

嵌入式场景下，RAII 同样适用，但有几点需注意：

- **`-fno-exceptions` 环境**：析构照常工作（析构不依赖异常机制）；但构造函数里的错误无法通过异常报告，改用工厂函数 + 返回 `std::optional` 或错误码。
- **`unique_ptr` 零开销**：在大多数平台上，`unique_ptr` 与裸指针生成完全相同的代码，没有运行时开销。
- **静态对象析构顺序**：全局/静态 RAII 对象的析构顺序是构造的逆序，但跨翻译单元的顺序未定义（静态初始化顺序问题，Static Initialization Order Fiasco）。

```cpp
// 嵌入式风格：无异常，工厂函数返回 optional
class GpioPin {
public:
    static std::optional<GpioPin> open(int pin_num) {
        if (pin_num >= MAX_PINS) return std::nullopt;
        return GpioPin(pin_num);
    }
    ~GpioPin() { gpio_release(pin_); }

private:
    explicit GpioPin(int pin) : pin_(pin) { gpio_acquire(pin_); }
    int pin_;
};

// 使用
auto pin = GpioPin::open(5);
if (!pin) { /* 处理错误 */ return; }
// pin 超出作用域时自动 gpio_release
```

---

## 延伸阅读

- [[编程语言/C++/C++ 对象模型与 Rule of Zero-Three-Five]]（Rule of 0/3/5 与移动语义）
- [[编程语言/C/C 内存模型与未定义行为]]（C 侧内存陷阱）
- [[编程语言/C++/C++多线程与多进程编程]]（`lock_guard` 实战）
- [[编程语言/C++/嵌入式 C++ 编译约束]]（`-fno-exceptions` 下的 RAII）
