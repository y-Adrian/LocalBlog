## 0.1 `atomic` 是什么

`std::atomic<T>` 是 C++ 提供的原子类型包装器，用来让某个对象的读写或修改操作具备原子性。

所谓“原子性”，可以简单理解为：一个线程正在进行某个原子操作时，其他线程不会看到这个操作进行到一半的中间状态。

例如多个线程同时执行 `count++`，如果 `count` 是普通 `int`，这个操作不是线程安全的；如果 `count` 是 `std::atomic<int>`，那么 `count++` 就是原子操作。

```cpp
#include <atomic>

std::atomic<int> count{0};

void add()
{
    count++;
}
```

## 0.2 `atomic` 和 `mutex` 的区别

`atomic` 和 `mutex` 都能用于多线程同步，但适用场景不同。

`atomic` 适合保护单个简单变量，例如计数器、状态标志、指针等。它通常不需要显式加锁，操作粒度比较小。

`mutex` 适合保护一段复杂逻辑或多个共享变量。它通过 `lock` / `unlock` 建立临界区，保证同一时间只有一个线程能进入这段代码。

简单对比：

| 对比项 | `atomic` | `mutex` |
|---|---|---|
| 机制 | 原子操作 | 加锁互斥 |
| 适合场景 | 单个变量的简单读写或修改 | 多个变量或复杂逻辑 |
| 是否阻塞 | 通常不阻塞 | 可能阻塞等待锁 |
| 保护范围 | 通常保护一个对象 | 可以保护一段代码 |
| 常见用途 | 计数器、标志位、指针 | 容器、结构体、复杂状态 |

如果只是 `count++`，优先考虑 `std::atomic<int>`。

如果要同时修改 `balance` 和 `total`，并且要求它们作为一个整体保持一致，通常应该用 `std::mutex`。

## 0.3 `atomic` 只能用于基础类型吗

不是。

`std::atomic<T>` 不只支持 `int`、`bool`、指针这类基础类型，也可以支持某些自定义类型。

但自定义类型通常需要满足一个重要条件：`T` 必须是可平凡拷贝类型，英文叫 `trivially copyable`。

这种结构体通常可以：

```cpp
struct TwoInt {
    int a;
    int b;
};
```

这种结构体通常不适合直接放进 `std::atomic<T>`：

```cpp
#include <string>
#include <vector>

struct Data {
    std::string name;
    std::vector<int> values;
};
```

原因是 `std::string` 和 `std::vector` 内部涉及堆内存、构造析构、资源管理等复杂行为，不是简单的内存拷贝对象。

## 0.4 为什么 `std::atomic<TwoInt>` 不能直接访问字段

假设有代码：

```cpp
#include <atomic>

typedef struct {
    int a;
    int b;
} TwoInt;

int main()
{
    std::atomic<TwoInt> t;
    t.a = 0;
    t.b = 0;
}
```

这会报错，类似：`struct std::atomic<TwoInt> has no member named 'a'`。

原因是 `t` 的类型不是 `TwoInt`，而是 `std::atomic<TwoInt>`。

`std::atomic<TwoInt>` 是一个原子包装器，它本身没有 `a` 和 `b` 这两个成员。`a` 和 `b` 属于被包装的 `TwoInt`，不能通过 `t.a` 直接访问。

正确做法是通过 `load()` 和 `store()` 整体读写。

```cpp
#include <atomic>
#include <iostream>

typedef struct {
    int a;
    int b;
} TwoInt;

int main()
{
    std::atomic<TwoInt> t{TwoInt{0, 0}};

    t.store(TwoInt{1, 2});

    TwoInt value = t.load();
    std::cout << value.a << " " << value.b << std::endl;

    return 0;
}
```

关键点是：`std::atomic<TwoInt>` 表示把整个 `TwoInt` 当成一个整体进行原子操作，而不是分别访问里面的字段。

## 0.5 把结构体当成整体做原子读写

对于 `TwoInt` 这种简单结构体，可以写：

```cpp
std::atomic<TwoInt> t{TwoInt{0, 0}};
```

整体写入：

```cpp
t.store(TwoInt{1, 2});
```

整体读取：

```cpp
TwoInt cur = t.load();
```

整体替换：

```cpp
TwoInt old = t.exchange(TwoInt{3, 4});
```

比较并交换：

```cpp
TwoInt expected{3, 4};
bool ok = t.compare_exchange_strong(expected, TwoInt{5, 6});
```

这里的含义是：只有当 `t` 当前值等于 `expected` 时，才把它改成 `TwoInt{5, 6}`。

如果比较成功，`ok` 为 `true`。

如果比较失败，`ok` 为 `false`，并且 `expected` 会被更新成 `t` 当前的真实值。

## 0.6 `std::atomic<T>` 常用操作

通用操作包括：

| 操作 | 作用 |
|---|---|
| `load()` | 原子读取 |
| `store()` | 原子写入 |
| `exchange()` | 原子替换，并返回旧值 |
| `compare_exchange_weak()` | 比较并交换，允许假失败，常用于循环 |
| `compare_exchange_strong()` | 比较并交换，语义更强 |
| `is_lock_free()` | 运行时判断当前对象是否无锁 |
| `is_always_lock_free` | 编译期判断该类型是否总是无锁 |

对于整数类型，例如 `std::atomic<int>`，还支持：

| 操作 | 作用 |
|---|---|
| `fetch_add()` | 原子加法，返回旧值 |
| `fetch_sub()` | 原子减法，返回旧值 |
| `fetch_and()` | 原子按位与 |
| `fetch_or()` | 原子按位或 |
| `fetch_xor()` | 原子按位异或 |
| `++` / `--` | 原子自增、自减 |
| `+=` / `-=` | 原子加减 |

例如：

```cpp
std::atomic<int> x{0};

x.fetch_add(1);
++x;
x += 3;
```

对于指针类型，例如 `std::atomic<int*>`，通常支持 `fetch_add()` 和 `fetch_sub()`，表示指针按元素移动。

对于自定义结构体，例如 `std::atomic<TwoInt>`，一般主要使用 `load()`、`store()`、`exchange()`、`compare_exchange_weak()`、`compare_exchange_strong()` 和 `is_lock_free()`。

它不能使用 `fetch_add()`，因为编译器不知道两个 `int` 组成的结构体“加一下”应该是什么意思。

## 0.7 是否一定是无锁的

不一定。

`std::atomic<T>` 保证的是操作语义上的原子性，但底层实现不一定总是无锁。

比如 `std::atomic<int>` 在很多平台上通常是无锁的。

但 `std::atomic<TwoInt>` 这种包含两个 `int` 的结构体，大小可能是 8 字节。有些平台可以用硬件原子指令处理，有些平台可能会退化成内部锁。

可以用 `is_lock_free()` 检查：

```cpp
std::atomic<TwoInt> t{TwoInt{0, 0}};

if (t.is_lock_free()) {
    // 当前平台上这个 atomic 对象是无锁的
}
```

也可以用 `is_always_lock_free` 做编译期判断：

```cpp
static_assert(std::atomic<TwoInt>::is_always_lock_free);
```

注意：这个断言不一定能通过，因为是否总是无锁取决于类型和平台。

## 0.8 两种结构体写法的区别

写法一：整体原子。

```cpp
struct TwoInt {
    int a;
    int b;
};

std::atomic<TwoInt> t;
```

这种写法表示：`a` 和 `b` 作为一个整体被原子读写。

适合需要保证读取时看到的是同一个版本的 `a` 和 `b` 的场景。

写法二：字段分别原子。

```cpp
struct TwoInt {
    std::atomic<int> a;
    std::atomic<int> b;
};

TwoInt t;
```

这种写法表示：`a` 和 `b` 各自是原子的。

但是它不保证 `a` 和 `b` 作为整体一致。例如一个线程刚更新完 `a`，还没更新 `b`，另一个线程可能已经读到了新 `a` 和旧 `b`。

所以：

- 如果要“整体一致”，使用 `std::atomic<TwoInt>` 或 `mutex`。
- 如果字段互不相关，只要求各自线程安全，可以使用 `std::atomic<int>` 字段。

## 0.9 C 语言中能不能做原子读写

能。

C 从 C11 开始提供原子操作，头文件是 `<stdatomic.h>`。

整数原子变量示例：

```c
#include <stdatomic.h>

atomic_int count;

int main(void)
{
    atomic_init(&count, 0);

    atomic_fetch_add(&count, 1);

    int v = atomic_load(&count);

    atomic_store(&count, 10);

    return 0;
}
```

C 里也可以使用 `_Atomic(T)` 表示某个类型的原子对象。

例如：

```c
#include <stdatomic.h>

typedef struct {
    int a;
    int b;
} TwoInt;

int main(void)
{
    _Atomic(TwoInt) t;

    TwoInt init = {0, 0};
    atomic_store(&t, init);

    TwoInt cur = atomic_load(&t);

    return cur.a + cur.b;
}
```

和 C++ 一样，不能对 `_Atomic(TwoInt)` 直接写 `t.a = 1`，因为 `t` 已经是原子对象，不是普通结构体对象。

## 0.10 实际工程建议

常见选择可以这样判断：

- 单个计数器：用 `std::atomic<int>`。
- 单个状态标志：用 `std::atomic<bool>`。
- 单个指针或对象版本切换：可以考虑原子指针或 `std::atomic<std::shared_ptr<T>>`。
- 多个字段必须整体一致：考虑 `std::atomic<简单结构体>` 或 `std::mutex`。
- 复杂对象，例如包含 `std::string`、`std::vector`、文件句柄、网络连接等：通常用 `std::mutex` 保护。

一句话总结：

`atomic` 适合小而简单的共享状态；复杂对象和复杂逻辑，优先考虑 `mutex`。
