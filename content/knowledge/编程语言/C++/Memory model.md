---
title: Questions at first
date: 2026/09/18
aliases:
  - "编程语言/C++/Memory model"
  - "articles/编程语言/C++/Memory model"
contentType: knowledge
showArticleMeta: true
modified: 2026-10-12
---
# 1 Questions at first

+ **For shared memory, if different processes mapped one shared memory, and they manipulate one data with atomic operation, will the atomic operation work correctly to solve the problem of data races?** 
	Hardware atomics can be useful for processes mapping the same shared pages, but this is not a blanket portability guarantee for arbitrary `std::atomic<T>`. Check the compiler/runtime contract, alignment, object initialization, shared layout and whether the exact operation is lock-free on the target. A non-lock-free implementation may call a runtime helper; it must not be assumed to provide process-shared synchronization. Even a lock-free counter does not make the surrounding queue or payload correct: publication, consumption and reclamation still need an explicit protocol.
	See [GCC atomic builtins and runtime fallback](https://gcc.gnu.org/onlinedocs/gcc/_005f_005fatomic-Builtins.html), [[knowledge/linux/内核机制/POSIX 共享内存：初始化、同步与生命周期]] and [[knowledge/通信与IPC/共享内存通信框架：协议、队列与故障恢复]].
+ **What is the memory model difference between c and c++?**
	For concurrent programming with atomics, mutexes, and memory ordering, the semantics you reason about are essentially the same. Code written against the common atomics model ports between C and C++ with only syntactic/library changes. Compilers implement the same underlying guarantees(and the same allowed reorderings/optimizations under the as-if rule).
# 2 learn

## 2.1 process memory model
This is about where objects live
At the executable/process level, you can roughly imagine:
```bash
Higher address
+----------------------+
|        Stack         |
|          ↓           |
|                      |
|          ↑           |
|        Heap          |
+----------------------+
|        .bss          |
+----------------------+
|        .data         |  global
+----------------------+
|       .rodata        |
+----------------------+
|        .text         |  machine code
+----------------------+
Lower address
```
This is not yet the c/c++ memory model, this is mainly the process/address-space layout.

## 2.2 C/C++ object model
Lifetime, storage duration, alignment, aliasing.

+ object representation -- the bytes in memory to representing a object
+ alignment
+ padding
+ sizeof
+ alignof
+ storage duration
+ object lifetime
+ effective/dynamic type
+ strict aliasing


## 2.3 Compiler memory model
What optimizations the compiler may legally perform.

Suppose we have this code:
```c
int flag = 0;

void wait()
{
    while (flag == 0) {
    }
}
```

In function wait, we may think the program runs like this:
```bash
loading flag
compare with 0
loading flag
compare with 0
loading flag
compare with 0
```
But the compiler does not have to implement your mental model.

Conceptually, optimizations may make it look like this:
```c
if (flag == 0) {
    while (true) {
    }
}
```
in circumstance where the languages rules allow that reasoning. This is where you need to understand the **as-if rule** and observable behavior.

It also leads to a **very important lesson**:`volate int flag` and `std::atomic<int> flag` solve different problems. This distinction is very important.


## 2.4 Concurrency memory model
Data races, atomics, happens-before


## 2.5 Hardware memory model
CPU reordering, cache coherence, memory barriers.


## 2.6 Linux/embeded application
volatile, MMIO, kernel barriers, lock-free programming
