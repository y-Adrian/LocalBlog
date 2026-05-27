---
title: RAII
date: 2026/05/11
---
资源获取即初始化，Resource Acquisition Is Initialization。

资源跟着对象走，对象活资源就活，对象死资源就释放。即**把资源生命周期绑定到对象生命周期。**

机制深化（Rule of 0/3/5、移动语义、异常安全）见 [[C++ 对象模型与 Rule of Zero-Three-Five]]。C 侧内存与 UB 见 [[编程语言/C/C 内存模型与未定义行为]]。
