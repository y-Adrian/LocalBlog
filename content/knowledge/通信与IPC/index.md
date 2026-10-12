---
title: IPC & Communication Frameworks
description: 从共享内存基础到消息协议、队列、通知与故障恢复
contentType: page
hideTitle: true
hideCreatedDate: true
hideReadingTime: true
---
# IPC & Communication Frameworks

这一专题按“机制 → 生命周期 → 框架协议 → 并发优化”组织。先明确正确性和失败语义，再优化载荷复制和通知开销。

## 1. 机制与对象生命周期

- [[knowledge/linux/内核机制/传统 IPC：System V 与 POSIX|IPC 机制对比与选型]]
- [[knowledge/linux/内核机制/POSIX 共享内存：初始化、同步与生命周期|共享内存初始化、同步与退出]]

## 2. 通信框架

- [[knowledge/通信与IPC/共享内存通信框架：协议、队列与故障恢复|协议、队列、背压与故障恢复]]
- [[knowledge/网络与DPDK/实践/RPC 技术与分层详解|RPC 分层总览]]
- [[knowledge/通信与IPC/本机 RPC：超时、幂等与跨重启去重|本机 RPC 的超时、业务键与持久去重]]

## 3. 队列与通知协议

- [[knowledge/通信与IPC/SPSC 共享队列：发布、消费与槽位回收|SPSC 的容量、发布与回收]]
- [[knowledge/通信与IPC/共享队列通知：eventfd、futex 与防丢唤醒|条件变量、eventfd、futex 与防丢唤醒]]

## 4. 配套实践

- [[knowledge/通信与IPC/共享内存双进程实践：握手、背压与退出|Linux 双进程共享队列：握手、背压与退出]] — 源码在仓库 `labs/shared-memory-ipc/`，尚无 Linux 执行记录。

## 5. 并发与优化

- [[knowledge/通信与IPC/共享对象池与零拷贝：句柄、借用与回收|共享对象池：句柄、借用与安全回收]]

- [[knowledge/编程语言/C++/Memory model|原子操作的进程共享边界]]
- [[knowledge/编程语言/C++/内存模型|C++ 内存序]]
- [[knowledge/编程语言/C++/无锁编程|SPSC、CAS 与内存回收]]

- [[knowledge/网络与DPDK/实践/多 worker 与 mempool 并发假设|worker 交接与对象池并发配置]]

## 后续深化

双进程源码的 Linux 构建与故障记录、对象池协议的配套实现、持久幂等表和同事务业务示例，以及相同语义下的性能对照。当前基础与关键协议条目已成文；不把设计说明等同于实现或实测结果。
