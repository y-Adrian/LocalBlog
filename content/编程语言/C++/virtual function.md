---
title: Questions at beginning
date: 2026/09/18
---
# 1 Questions at beginning

+ How is virtual function implemented?
+ How can I see the structure through inspecting in an executable?
+ What is the derived class's memory layout looks like?
+ Before I use virtual in function `speak`, the size of object dog is 1, after I adding virtual, the size changed to 8, why is that?
+ What is Object slicing?
+ How to understand the assembly in arm:
```asm
  0000000000000954 <test(Base*)>:
 954:	a9be7bfd 	stp	x29, x30, [sp, #-32]!
 958:	910003fd 	mov	x29, sp
 95c:	f9000fe0 	str	x0, [sp, #24]
 960:	f9400fe0 	ldr	x0, [sp, #24]
 964:	f9400000 	ldr	x0, [x0]
 968:	f9400001 	ldr	x1, [x0]
 96c:	f9400fe0 	ldr	x0, [sp, #24]
 970:	d63f0020 	blr	x1
 974:	a8c27bfd 	ldp	x29, x30, [sp], #32
 978:	d65f03c0 	ret
```
# 2 abstract
*There has no dictations or specifications in c++ standard on how to implement virtual function, and c++ standard does not require virtual functions to be implemented using a vtable, mainstream compilers like `GCC/Clang` implement it by using `vptr` and `vtable`.*

*Each derived class has one or more vtables. When a derived class inherits from multiple base class that both have virtual functions, the single derived class will have multiple vtables(and multiple `vptr`s in its object layout).*

Here I will learn in this order:
+ normal function -> observe static binding
+ virtual function -> observe dynamic dispatch
+ inspect object size
+ inspect the object's `vptr`
+ inspect the `vtable`
+ inspect assembly and see the indirect `call`

# 3 Step by step

## 3.1 start with the problem: static binding
Let's see this code first:
```c
// static_binding.cpp
#include <iostream>

class Base {
public:
    void f() {
        std::cout << "Base::f\n";
    }

    void g() {
        std::cout << "Base::g\n";
    }
};

class Derived : public Base {
public:
    void f() {
        std::cout << "Derived::f\n";
    }

    void g() {
        std::cout << "Derived::g\n";
    }
};

int main()
{
    Derived d;
    Base *p = &d;

    p->f();
    p->g();
    return 0;
}
```

Run this program after compiled with `g++ -std=c++17 -O0 -g static_binding.cpp -o static_binding`, we can see the output:
```bash
Base::f
Base::g
```

Even though `p` actually points to a `Derived`, the function called finally are from the class `Base`. This is because function `f` and `g` are non-virtual functions. The compiler determines the target mainly from the static type of the expression. Therefore `p->f()` is resolved to `Base::f()`. So as the `p->g()`.

Also we can see the content of object `d` with gdb:

```bash
(gdb) p d
$1 = {<Base> = {<No data fields>}, <No data fields>}
```

Apparently, there is no `vptr`. This is because in class `Base` there has no keyword `virtual` in function declaration. And in class `Derived`, there are same functions as the class `Base`. But there are not override, they are *function hiding*(also called function shadowing). The derived class function simply hides the base class function of the same name.

## 3.2 Dynamic dispatch

Then we add virtual in our code:
```c++
// dynamic_dispatch.cpp
#include <iostream>

class Base {
public:
    virtual void f() {
        std::cout << "Base::f\n";
    }

    virtual void g() {
        std::cout << "Base::g\n";
    }
};

class Derived : public Base {
public:
    void f() {
        std::cout << "Derived::f\n";
    }

    void g() {
        std::cout << "Derived::g\n";
    }
};

int main()
{
    Derived d;
    Base *p = &d;

    p->f();
    p->g();
    return 0;
}
```

Then we compile it with `g++ -std=c++17 -O0 -g dynamic_dispatch.cpp -o dynamic_dispatch`, and run it. Here is the output:
```bash
Derived::f
Derived::g
```
**This is the fundamental purpose of virtual functions:**
	*A virtual function allows the function implementation to be selected according to the object's dynamic type, rather than only the pointer/reference's static type.*

The static type is known at compile time. The dynamic type describes the actual object at runtime.

**Once virtual, always virtual down the inheritance chain**.

## 3.3 inspect

We can also run the program with gdb, and we can get many informations.

In c++, the size of an empty class without data members is not zero. The size if typically 1 byte. Under certain conditions, it could be larger, such as multiple inheritance.

Here we check the size of the instance of class `Derived` d.
```bash
(gdb) p sizeof(d)
$1 = 8
```
On a typical 64-bit platform, the size is 8. This is because a `vptr` itself is typically 8 bytes.
```bash
# See what is the memory layout looks like in object d
(gdb) p d
$2 = {<Base> = {_vptr.Base = 0xaaaaaaab1d18 <vtable for Derived+16>}, <No data fields>}
```
In object d, the first 8 byte is `vptr`.
```shell
# The memory address of object d
(gdb) p &d
$5 = (Derived *) 0xfffffffff288

# As we can see the result of `p d`, the first 8 byte is vptr
(gdb) x/gx &d
0xfffffffff288:	0x0000aaaaaaab1d18
```
This `vptr` points to `vtable`:
```
# See the content the vptr points to(vtable)
(gdb) x/4gx 0x0000aaaaaaab1d18
0xaaaaaaab1d18 <_ZTV7Derived+16>:	0x0000aaaaaaaa0c68	0x0000aaaaaaaa0c94
0xaaaaaaab1d28 <_ZTI7Derived>:	0x0000fffff7fad9b0	0x0000aaaaaaaa0d00

# see 0x0000aaaaaaaa0c68
(gdb) info symbol 0x0000aaaaaaaa0c68
Derived::f() in section .text of /home/adrian/learn/virtual_function/inspect

# see 0x0000aaaaaaaa0c94
(gdb) info symbol 0x0000aaaaaaaa0c94
Derived::g() in section .text of /home/adrian/learn/virtual_function/inspect
```

Next we inspect assembly and see the indirect call. 
Here we run `gcc -S dynamic_dispatch.cpp -o dynamic_dispatch.S` and check the part of main:
```bash
main:
.LFB1733:
	.cfi_startproc
	sub	sp, sp, #48                     ; sp = sp - 48, reserve 48 bytes for stack
	.cfi_def_cfa_offset 48
	stp	x29, x30, [sp, 32]              
	.cfi_offset 29, -16
	.cfi_offset 30, -8
	add	x29, sp, 32
	adrp	x0, :got:__stack_chk_guard
	ldr	x0, [x0, #:got_lo12:__stack_chk_guard]
	ldr	x1, [x0]
	str	x1, [sp, 24]
	mov	x1, 0
	adrp	x0, _ZTV7Derived+16         ; get 4KB aligned base address
										; lowest 12 bits are cleared to zero
	add	x0, x0, :lo12:_ZTV7Derived+16   ; add its offset in the page, then we get the vptr
	str	x0, [sp, 8]                     ; store vptr to object(sp + 8)
	add	x0, sp, 8                       ; take the address of the object
	str	x0, [sp, 16]                    ; store it to sp + 16(pointer here)
	ldr	x0, [sp, 16]                    ; get the address
	ldr	x0, [x0]                        ; get the content at the address, vtable address
	ldr	x1, [x0]                        ; get the function at vtable[0]
	ldr	x0, [sp, 16]                    ; reload this, x0 is the first argument
	blr	x1                              ; indirect call
	ldr	x0, [sp, 16]                    ; get the address
	ldr	x0, [x0]                        ; get the content at the address, vtable address
	add	x0, x0, 8                       ; add offset 8(size of pointer)
	ldr	x1, [x0]                        ; get the function at vtable[1]
	ldr	x0, [sp, 16]                    ; reload this, x0 is the first argument
	blr	x1
	mov	w0, 0                           ; return 0
	mov	w1, w0
	adrp	x0, :got:__stack_chk_guard
	ldr	x0, [x0, #:got_lo12:__stack_chk_guard]
	ldr	x3, [sp, 24]
	ldr	x2, [x0]
	subs	x3, x3, x2
	mov	x2, 0
	beq	.L5
	bl	__stack_chk_fail
```

The key pattern is:
```bash
	ldr	x0, [sp, 16]  ; load object pointer
	ldr	x0, [x0]      ; load vptr from object
	ldr	x1, [x0]      ; load function pointer from vtable[0]
	ldr	x0, [sp, 16]  ; x0 = this
	blr	x1            ; indirect call
```

`_ZTV7Derived` is `vtable for Derived`. 

The memory layout is like:
```bash
Derived object
+------------------+
| vptr             | ----+
+------------------+     |
| member data...   |     |
+------------------+     |
                       |
                       v
                 Derived vtable
                 +------------------+
                 | &Derived::f    |  offset 0
                 +------------------+
                 | &Derived::g    |  offset 8
                 +------------------+
```


# 4 Try to answer the questions by yourself.
+ How is virtual function implemented?
	*Typically, virtual function is implemented by using `vptr` and `vtable`. The real implementation is selected according to object's dynamic type at runtime.*
+ What is the memory layout of the instance of the derived class looks like?
		*If a class inherits from one base class, `vptr` is at the start of the object's memory.*
		*If a class inherits from multiple base classes, the object's memory layout consists of memories of classes it derived, and arranged by the inherit order. Each part of the base class memory starts with `vptr`*.
+ Before I use virtual in function `speak`, the size of object dog is 1, after I adding virtual, the size changed to 8, why is that?
	*An empty C++ object still needs a nonzero size, and a polymorphic object needs a hidden pointer. On a typical 64-bit platform, the size is typically 8 byte*.
+ What is Object slicing?
	*This often occurs when we assign a object of derived class to a base class type object in a polymorphic case, such as `Derived d; Base b = d`. The memory layout of these two object is different. Assigning d to b with `=`, causes a truncate of memory, object d can only aware the first part of object d*.