---
title: Trivial knowledge points
date: 2026/09/18
---
## 0.1 private constructor
A private constructor prevents code without private access from directly constructing the class. Objects can still be created by member functions or friends, so private constructors are commonly used for factory patterns, singletons, and controlled object creation.
	构造函数私有能够防止没有私有函数访问权限的代码直接构造对象。对象依然可以通过成员函数或友元函数创建，因此私有构造函数通常用于工厂模式，单例以及控制对象创建。

Here we see, objects can be created by friends. Why?
	In c++, a friend is explicitly granted access to a class's private and protected members. A constructor is a member function, so a private constructor follows exactly the same access rule. Friendship is not automatically symmetric.
	C++中，友元函数明确被授予类的私有以及保护成员的访问权限

So the fundamental rule is: private does not mean "only this class can access it".


## 0.2 the main difference between c and c++

The main difference is:

C is primarily procedural and gives you relatively direct control over data and memory. C++ builds on that foundation with abstractions such as classes, RAII, templates, generic programming, and polymorphism.

C是过程性语言，你可以直接操作数据和内存，C++在此基础上进行了一些抽象：类、RAII、模板、泛型编程和多态。

## 0.3 constructors, destructors and virtual functions

Constructors initialize an object and establish its valid state when its lifetime begins. C++ provide several forms, including default, copy, and move constructors, and members should generally be initialized through member initializer list.

Destructors run when an object's lifetime ends and are commonly used with RAII to release resources such as memory, file descriptors, mutexes, or device handles automatically.

Virtual functions provide runtime polymorphism. When calling a virtual function through a base pointer or reference, the implementation is selected based on object's dynamic type. Most C++ implementation achieve this using `vptr` in the object and a `vtable` containing virtual-function addresses.

One important connection is the virtual destructor. If derived objects can be delete through a base pointer, the base destructor should be virtual so the complete derived object is destroyed correctly.

Also, virtual calls make from constructors or destructors don't dispatch to more-derived overrides, because those derived parts not yet constructed or have already destroyed.


## 0.4 as-if rule

The compiler can transform the program in any way it wants, as if the observable behavior of the program were unchanged. This is one of the fundamental rules that allows compiler optimization.

In short, the as-if rule allows the compiler to perform any optimization as long as the observable behavior of a well-defined c++ program is preserved. Therefore, the generated machine code does not need to correspond directly to the source code.

## 0.5 Where are C++ exception are commonly used.
