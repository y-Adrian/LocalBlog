# 1 C++多线程与多进程编程

本文将从基础概念、核心 API、同步机制、实战实例到避坑指南，全面讲解 C\+\+ 中的多线程与多进程编程，帮助你彻底掌握并发编程的核心能力。

---

## 1.1 一、核心区别：线程 vs 进程

在开始之前，先搞清楚两者的本质差异，这是你选型和避坑的基础：

|特性|多线程|多进程|
|---|---|---|
|地址空间|共享同一进程的地址空间，共享内存、文件描述符等所有资源|完全独立的地址空间，资源严格隔离，互不干扰|
|创建开销|轻量级，仅需创建内核栈、线程控制块 \(TCB\)，开销极小|重量级，需要复制页表、复制进程资源，开销是线程的 10\~100 倍|
|切换开销|上下文切换仅需切换寄存器，开销极小|上下文切换需要刷新 TLB、切换页表，开销极大|
|通信方式|直接共享全局变量，配合同步原语即可，非常简单|必须通过专门的 IPC（进程间通信）机制：管道、共享内存、消息队列、Socket 等|
|稳定性|一个线程崩溃会导致整个进程崩溃，所有线程一起退出|一个进程崩溃不影响其他进程，隔离性极强|
|数据竞争|极易出现，所有共享资源都需要手动同步|天然无数据竞争，因为资源完全隔离|
|适用场景|CPU 密集型并行计算、IO 密集型任务并行、轻量级并发|强隔离的服务、独立任务、需要稳定性的场景|

---

## 1.2 二、C++ 多线程编程

C++11 之后引入了标准线程库 `std::thread`，彻底解决了之前跨平台线程 API 不统一的问题，现在你可以用一套代码跑在 Linux、Windows、Mac 上。

### 1.2.1 基础：线程的创建与管理

#### 1.2.1.1 核心 API：`std::thread`

`std::thread` 是线程的核心类，创建对象时就会启动线程，执行你传入的函数。

**两个关键方法：**

- `join()`：等待线程执行完成，回收线程资源，主线程会阻塞到线程结束。**99% 的场景都应该用这个**。

- `detach()`：将线程分离，后台运行，主线程不用等待，分离后你无法再控制这个线程。

#### 1.2.1.2 基础实例：创建两个并行线程

```cpp
#include <iostream>
#include <thread>
#include <chrono>

// 线程执行的任务函数
void print_task(int thread_id) {
    for (int i = 0; i < 3; i++) {
        // 打印线程ID和运行计数
        std::cout << "线程 " << thread_id << " 运行中: 第" << i+1 << "次循环" << std::endl;
        
        // 模拟耗时操作，休眠100ms
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }
}

int main() {
    // 创建线程：传入任务函数和参数
    // 这一行执行完，线程就已经启动了！
    std::thread t1(print_task, 1);
    std::thread t2(print_task, 2);

    // 等待两个线程执行完成
    // 必须调用join！否则主线程退出时，会直接终止所有子线程
    t1.join();
    t2.join();

    std::cout << "所有线程执行完毕！" << std::endl;
    return 0;
}
```

**编译运行：**

```bash
g++ thread_basic.cpp -o thread_basic -pthread -std=c++11
./thread_basic
```

> 注意：GCC 下编译多线程代码必须加 `-pthread` 链接线程库。
> 
> 

---

### 1.2.2 线程同步：解决竞态条件

线程共享地址空间，所以多个线程同时操作同一个变量时，就会出现**竞态条件（Race Condition）**，导致结果错误。我们需要同步原语来保护共享资源。

#### 1.2.2.1 互斥锁 `std::mutex` 与锁守卫

互斥锁是最常用的同步工具，同一时间只有一个线程能拿到锁，其他线程只能等待。

我们用`lock_guard`来管理锁，它是 RAII 风格的锁守卫：**构造时加锁，析构时自动解锁**，彻底避免忘记解锁的问题。

#### 1.2.2.2 实例：线程安全的计数器

先看一个**错误的例子**，不加锁会发生什么：

```cpp
// 错误示例：不加锁，竞态条件
int counter = 0;
void increment() {
    for (int i = 0; i < 100000; i++) {
        // counter++ 不是原子操作！它分为三步：读counter、加1、写回counter
        // 两个线程同时执行，就会互相覆盖，结果错误
        counter++;
    }
}

int main() {
    std::thread t1(increment);
    std::thread t2(increment);
    t1.join();
    t2.join();
    // 预期结果是200000，但实际每次运行结果都不一样！
    std::cout << "计数器结果: " << counter << std::endl;
    return 0;
}
```

再看**加锁的正确版本**：

```cpp
#include <mutex>

std::mutex mtx; // 全局互斥锁，保护counter
int counter = 0;

void increment() {
    for (int i = 0; i < 100000; i++) {
        // lock_guard：自动加锁、自动解锁
        std::lock_guard<std::mutex> lock(mtx);
        counter++;
    }
}

// 运行结果永远是200000，完全正确！
```

#### 1.2.2.3 条件变量 `std::condition_variable`

条件变量用来实现"等待 - 通知"机制：当队列空的时候，消费者线程可以休眠等待，生产者生产数据后，再通知消费者醒来处理。

> 注意：条件变量必须配合`unique_lock`使用，因为`wait`函数会自动解锁锁，唤醒后再重新加锁。
> 
> 

#### 1.2.2.4 原子变量 `std::atomic`

对于简单的类型（比如 int、bool），你可以用原子变量，它比锁更轻量，天生线程安全，不需要加锁。

```cpp
#include <atomic>

// 原子计数器，天生线程安全
std::atomic<int> counter = 0;

void increment() {
    for (int i = 0; i < 100000; i++) {
        counter++; // 原子操作，不会有竞态条件
    }
}
```

---

### 1.2.3 经典实战：线程安全的生产者 - 消费者模型

生产者 \- 消费者是并发编程最经典的模型，它覆盖了线程创建、互斥锁、条件变量所有核心知识点，也是面试高频考点。

```cpp
#include <iostream>
#include <thread>
#include <mutex>
#include <condition_variable>
#include <queue>
#include <chrono>
#include <random>

// 线程安全的队列模板
template<typename T>
class SafeQueue {
private:
    std::queue<T> queue_;               // 底层队列
    std::mutex mtx_;                    // 互斥锁，保护队列
    std::condition_variable cv_;        // 条件变量，实现等待通知

public:
    // 生产者：往队列里放数据
    void push(T value) {
        // 加锁，保护队列操作
        std::lock_guard<std::mutex> lock(mtx_);
        queue_.push(value);
        
        // 通知消费者：有新数据了，快醒来！
        cv_.notify_one();
    }

    // 消费者：从队列里拿数据
    T pop() {
        // unique_lock：支持条件变量的wait操作
        std::unique_lock<std::mutex> lock(mtx_);
        
        // 等待直到队列非空
        // 注意：必须用while！防止虚假唤醒（操作系统可能会伪唤醒）
        cv_.wait(lock, [this]() { 
            return !queue_.empty(); 
        });
        
        // 取出数据
        T value = queue_.front();
        queue_.pop();
        return value;
    }
};

// 全局任务队列
SafeQueue<int> task_queue;
std::random_device rd;
std::mt19937 gen(rd());

// 生产者函数：生产数据
void producer(int producer_id) {
    // 随机休眠时间，模拟生产耗时
    std::uniform_int_distribution<> dis(100, 1000);
    
    for (int i = 0; i < 5; i++) {
        int data = producer_id * 100 + i; // 生产的数据
        std::cout << "生产者" << producer_id << " 生产了数据: " << data << std::endl;
        
        task_queue.push(data);
        
        // 模拟生产耗时
        std::this_thread::sleep_for(std::chrono::milliseconds(dis(gen)));
    }
}

// 消费者函数：消费数据
void consumer() {
    std::uniform_int_distribution<> dis(200, 800);
    
    // 消费10个数据
    for (int i = 0; i < 10; i++) {
        int data = task_queue.pop();
        std::cout << "消费者 消费了数据: " << data << std::endl;
        
        // 模拟消费耗时
        std::this_thread::sleep_for(std::chrono::milliseconds(dis(gen)));
    }
}

int main() {
    // 启动线程：1个消费者，2个生产者
    std::thread c_thread(consumer);
    std::thread p1_thread(producer, 1);
    std::thread p2_thread(producer, 2);

    // 等待所有线程完成
    p1_thread.join();
    p2_thread.join();
    c_thread.join();

    std::cout << "所有任务执行完成！" << std::endl;
    return 0;
}
```

**编译运行：**

```bash
g++ producer_consumer.cpp -o pc -pthread -std=c++11
./pc
```

运行后你会看到，生产者生产数据，消费者自动消费，完美协调，没有任何竞态问题。

---

### 1.2.4 2\.4 多线程避坑指南

1. **永远不要忘记调用 `join()`**：如果线程对象销毁前你没调用`join`或`detach`，程序会直接崩溃。

2. **避免死锁**：

    - 不要嵌套加锁，如果必须加多个锁，要按固定顺序加

    - 用`std::lock(mtx1, mtx2)`同时加多个锁，避免互相等待

3. **锁的粒度要小**：不要把大段代码都锁起来，只锁共享资源的操作，不然并发度会很低。

4. **警惕虚假唤醒**：条件变量的`wait`永远用`while`判断，不要用`if`。

5. **不要用 detach 除非你真的需要**：分离的线程你无法控制，出问题很难排查。

---

## 1.3 三、C\+\+ 多进程编程

C\+\+ 标准库本身没有提供进程的 API，我们通常用**POSIX 标准的进程 API**（Linux、Mac、WSL 都支持，Windows 下需要用 Win32 API），核心是`fork()`系统调用。

### 1.3.1 基础：进程的创建与`fork()`

`fork()`是创建进程的核心函数，它有一个非常神奇的特性：**调用一次，返回两次**。

- 父进程调用`fork()`后，会完全复制一份自己，创建出子进程

- 父进程中，`fork()`返回**子进程的 PID**

- 子进程中，`fork()`返回**0**

- 如果出错，返回 -1

> 底层原理：fork 采用**写时复制（Copy\-on\-Write）**，一开始父子进程共享同一块内存，只有当其中一个进程修改内存时，才会复制一份，所以效率很高。

#### 1.3.1.1 基础实例：创建子进程

```cpp
#include <iostream>
#include <unistd.h>   // fork、getpid
#include <sys/wait.h> // waitpid

int main() {
    int x = 100; // 测试变量，父子进程各有一份
    
    // 创建子进程
    pid_t pid = fork();
    
    if (pid == -1) {
        // fork失败
        perror("fork failed");
        return 1;
    } else if (pid == 0) {
        // 子进程：这里是子进程的执行逻辑
        std::cout << "我是子进程，PID: " << getpid() << std::endl;
        std::cout << "子进程看到的x: " << x << std::endl;
        
        // 修改x，只会修改自己的副本，不会影响父进程！
        x = 200;
        std::cout << "子进程修改后的x: " << x << std::endl;
        
        sleep(1); // 子进程休眠1秒
        return 0;
    } else {
        // 父进程：这里是父进程的执行逻辑
        std::cout << "我是父进程，PID: " << getpid() << std::endl;
        std::cout << "父进程的子进程PID: " << pid << std::endl;
        std::cout << "父进程的x: " << x << std::endl; // 父进程的x还是100！
        
        // 等待子进程退出，回收资源，防止僵尸进程
        int status;
        waitpid(pid, &status, 0);
        if (WIFEXITED(status)) {
            std::cout << "子进程正常退出，退出码: " << WEXITSTATUS(status) << std::endl;
        }
    }
    
    return 0;
}
```

**运行结果：**

```Plain Text
我是父进程，PID: 12345
父进程的子进程PID: 12346
父进程的x: 100
我是子进程，PID: 12346
子进程看到的x: 100
子进程修改后的x: 200
子进程正常退出，退出码: 0
```

> 注意：父子进程的执行顺序是不确定的，操作系统会调度，所以输出顺序可能不一样。
> 
> 

---

### 1.3.2 进程间通信（IPC）

因为进程的地址空间是完全独立的，你不能像线程一样直接共享变量，必须通过 IPC 机制来通信。

常用的 IPC 有：

1. **管道（Pipe）**：最简单的 IPC，适合父子进程间的单向通信

2. **共享内存（Shared Memory）**：最快的 IPC，让两个进程映射同一块内存，直接读写

3. **消息队列（Message Queue）**：可以传递结构化的消息

4. **Socket**：可以跨机器通信，最通用的 IPC

#### 1.3.2.1 实例 1：匿名管道通信

管道是最基础的 IPC，它是一个字节流，父进程写，子进程读。

```cpp
#include <iostream>
#include <unistd.h>
#include <sys/wait.h>
#include <cstring>

int main() {
    int pipefd[2]; 
    // 管道的两个文件描述符：
    // pipefd[0] = 读端
    // pipefd[1] = 写端
    if (pipe(pipefd) == -1) {
        perror("pipe create failed");
        return 1;
    }

    pid_t pid = fork();
    if (pid == -1) {
        perror("fork failed");
        return 1;
    }

    if (pid == 0) {
        // 子进程：读管道
        close(pipefd[1]); // 子进程不用写，关闭写端
        
        char buf[1024];
        // 从管道读数据，没有数据的话会阻塞
        ssize_t n = read(pipefd[0], buf, sizeof(buf)-1);
        std::cout << "子进程收到父进程的消息: " << buf << std::endl;
        
        close(pipefd[0]);
        return 0;
    } else {
        // 父进程：写管道
        close(pipefd[0]); // 父进程不用读，关闭读端
        
        const char* msg = "Hello from parent process!";
        write(pipefd[1], msg, strlen(msg));
        std::cout << "父进程发送了消息" << std::endl;
        
        close(pipefd[1]);
        waitpid(pid, nullptr, 0);
    }

    return 0;
}
```

#### 1.3.2.2 实例 2：共享内存通信

共享内存是最快的 IPC，它让两个进程直接访问同一块物理内存，不需要拷贝数据。

```cpp
#include <iostream>
#include <unistd.h>
#include <sys/wait.h>
#include <sys/shm.h>
#include <cstring>

int main() {
    // 创建共享内存段，key=1234，大小1024，权限0666
    int shmid = shmget(1234, 1024, IPC_CREAT | 0666);
    if (shmid == -1) {
        perror("shmget failed");
        return 1;
    }

    pid_t pid = fork();
    if (pid == -1) {
        perror("fork failed");
        return 1;
    }

    if (pid == 0) {
        // 子进程：挂载共享内存
        char* shm_addr = (char*)shmat(shmid, nullptr, 0);
        if (shm_addr == (void*)-1) {
            perror("shmat failed");
            return 1;
        }
        
        // 读共享内存
        std::cout << "子进程从共享内存读到: " << shm_addr << std::endl;
        
        // 卸载共享内存
        shmdt(shm_addr);
        return 0;
    } else {
        // 父进程：挂载共享内存
        char* shm_addr = (char*)shmat(shmid, nullptr, 0);
        if (shm_addr == (void*)-1) {
            perror("shmat failed");
            return 1;
        }
        
        // 写共享内存
        const char* msg = "Hello from shared memory!";
        strcpy(shm_addr, msg);
        std::cout << "父进程写入了共享内存" << std::endl;
        
        // 等待子进程读完
        waitpid(pid, nullptr, 0);
        
        // 卸载并删除共享内存
        shmdt(shm_addr);
        shmctl(shmid, IPC_RMID, nullptr);
    }

    return 0;
}
```

---

### 1.3.3 多进程避坑指南

1. **必须回收子进程，防止僵尸进程**：子进程退出后，如果父进程不调用`wait/waitpid`，子进程会变成僵尸进程，占用系统资源。

2. **fork 之后关闭不用的文件描述符**：父子进程会继承文件描述符，不用的要关掉，不然会导致管道阻塞。

3. **不要在多线程程序里 fork**：fork 之后，子进程只会保留调用 fork 的那个线程，其他线程都会消失，如果其他线程刚好锁了 mutex，子进程拿到的锁就是锁死的，永远解不开。

4. **fork 之后不要调用非异步信号安全的函数**：比如 printf、malloc 这些，在多线程 fork 后可能会出问题。

---

## 1.4 四、选型指南：什么时候用线程？什么时候用进程？

|场景|推荐方案|原因|
|---|---|---|
|CPU 密集型并行计算（比如矩阵运算、数据处理）|多线程|线程开销小，切换快，通信方便，能最大化 CPU 利用率|
|IO 密集型任务（比如网络请求、文件读写）|多线程|轻量级，能同时处理大量 IO，资源占用小|
|后端服务，需要强稳定性，一个任务挂了不能影响其他|多进程|进程隔离，一个进程崩溃不会影响整个服务|
|需要运行不可信的代码、第三方程序|多进程|隔离性强，防止恶意代码破坏主进程|
|大规模数据共享，需要频繁通信|多线程|直接共享变量，比 IPC 快太多|
|需要跨机器、跨主机的通信|多进程 \+ Socket|进程可以独立部署，通过 Socket 通信|

---

## 1.5 五、编译运行说明

本文所有实例都可以直接编译运行：

- 多线程代码：`g\+\+ xxx\.cpp \-o xxx \-pthread \-std=c\+\+11`

- 多进程代码：`g\+\+ xxx\.cpp \-o xxx \-std=c\+\+11`

> 注意：多进程的 POSIX API 在 Linux、Mac、WSL 下都可以正常运行，Windows 下如果要运行，需要适配 Win32 的进程 API。
> 
> 

> （注：文档部分内容可能由 AI 生成）
