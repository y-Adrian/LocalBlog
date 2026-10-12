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
- [[knowledge/网络与DPDK/实践/RPC 技术与分层详解|RPC 分层、超时与幂等]]

## 3. 队列与通知协议

- [[knowledge/通信与IPC/SPSC 共享队列：发布、消费与槽位回收|SPSC 的容量、发布与回收]]
- [[knowledge/通信与IPC/共享队列通知：eventfd、futex 与防丢唤醒|条件变量、eventfd、futex 与防丢唤醒]]

## 4. 并发与优化

- [[knowledge/编程语言/C++/Memory model|原子操作的进程共享边界]]
- [[knowledge/编程语言/C++/内存模型|C++ 内存序]]
- [[knowledge/编程语言/C++/无锁编程|SPSC、CAS 与内存回收]]

- [[knowledge/网络与DPDK/实践/多 worker 与 mempool 并发假设|worker 交接与对象池并发配置]]

## 后续深化

可复现的双进程通信实现、共享对象池与零拷贝回收、跨重启的请求去重。当前专题已补齐 SPSC 发布回收与休眠唤醒的设计说明；实际性能与故障注入结果需要另行记录。
