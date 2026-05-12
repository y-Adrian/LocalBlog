# 1 Linux cgroup 完全指南：从原理到实践

在 Linux 系统中，我们经常会遇到这样的问题：

- 我有一个编译任务，不想让它占满整个 CPU，导致其他服务卡了

- 我要跑一个测试程序，怕它内存用太多，把系统搞 OOM 了

- 我有一堆进程，想限制它们总的磁盘 IO 速度，防止把硬盘打满

- 我想防止有人搞 fork 炸弹，把系统的进程数耗尽

这些问题，都可以用 **cgroup** 来解决。

cgroup 是 Linux 内核提供的一个强大的资源管理机制，它可以把进程分组，然后对整个组做资源的限制、统计、隔离。它是容器技术（Docker、Kubernetes）的底层核心，也是系统管理员管理资源的利器。

这篇文章，我会带你从基础到实践，彻底搞懂 cgroup，让你能熟练用它来管理系统资源。

---

## 1.1 一、基础认知：什么是 cgroup？

cgroup 的全称是 Control Group（控制组），它是 Linux 内核的一个功能，用来将进程组织成一个层级的分组，然后对这个分组进行资源的管理：

- **限制资源**：限制整个组能使用的 CPU、内存、IO 等资源的上限

- **统计监控**：统计整个组的资源使用情况

- **优先级控制**：给不同的组分配不同的资源优先级

- **隔离**：将不同组的进程隔离开，互不影响

### 1.1.1 1\.1 核心概念

- **层级结构**：cgroup 是树形的，父组的限制会作用于所有子组，子组的资源总和不能超过父组的限制

- **子系统（Controller）**：也叫控制器，每个控制器负责管理一种资源，比如 CPU、内存、IO 等

- **进程管理**：你可以把任意进程加入到 cgroup 中，整个组的所有进程都会被统一管理

### 1.1.2 1\.2 版本：v1 vs v2

cgroup 有两个大版本，v1 是旧版本，v2 是新版本，解决了 v1 的很多问题，现在新的系统（Ubuntu 22\.04\+、CentOS 9\+、Debian 11\+）默认都是 v2 了。

它们的区别：

|特性|cgroup v1|cgroup v2|
|---|---|---|
|层次结构|每个控制器独立的层级，你可以把进程放到不同控制器的不同组里|统一的层级，所有控制器共享同一个分组结构|
|控制器|分散的，每个控制器自己的规则|统一的，所有控制器协同工作|
|进程管理|可以把线程单独放到不同的组|进程是原子的，整个进程的所有线程都在同一个组|
|功能|基础的资源管理|更强大的功能，比如 PSI 压力信息、统一的限制逻辑|

> 💡 v1 已经被 deprecated 了，新的系统都推荐用 v2，这篇文章我们主要讲 v2，也会兼容 v1 的用法。
> 
> 

### 1.1.3 1\.3 怎么查看你的系统用的是哪个版本？

执行这个命令，就能知道：

```bash
# 查看是否支持 cgroup v2
test -f /sys/fs/cgroup/cgroup.controllers && echo "✅ 你的系统支持 cgroup v2" || echo "❌ 你的系统只支持 cgroup v1"

# 查看当前挂载的 cgroup
mount | grep cgroup
```

如果输出了 `cgroup2 on /sys/fs/cgroup type cgroup2`，说明你用的是 v2，完美。

---

## 1.2 二、核心子系统：cgroup 能管理哪些资源？

cgroup 通过不同的子系统（控制器）来管理不同的资源，常见的有这些：

| 子系统          | 作用                             |
| ------------ | ------------------------------ |
| `cpu`        | 限制 CPU 的带宽，设置 CPU 优先级          |
| `cpuset`     | 绑定 CPU 核心和内存节点，适合 NUMA 架构的大服务器 |
| `memory`     | 限制内存使用，统计内存使用情况，支持 OOM 控制      |
| `io`         | 限制磁盘 IO 的速度、权重，控制磁盘的读写         |
| `pids`       | 限制组内的最大进程数，防止 fork 炸弹          |
| `hugetlb`    | 限制大页内存的使用                      |
| `perf_event` | 性能事件的统计，用来做性能分析                |
| `rdma`       | 限制 RDMA 资源的使用                  |

---

## 1.3 三、cgroup 能做什么？核心用途

cgroup 的用途非常广泛，最常见的有：

### 1.3.1 1\. 资源限制

这是最常用的功能，你可以限制一个进程组最多用多少 CPU、多少内存、多少 IO，防止某个任务把整个系统搞挂了。

比如：

- 跑编译任务的时候，限制它最多用 50% 的 CPU，不影响其他服务

- 跑测试程序的时候，限制它最多用 1G 内存，防止 OOM

- 备份的时候，限制磁盘 IO 速度，不影响线上业务

### 1.3.2 2\. 资源优先级

你可以给不同的任务分配不同的资源权重，比如：

- 线上的服务，给它高优先级，保证它能拿到足够的资源

- 后台的批处理任务，给它低优先级，只有空闲的时候才让它跑

### 1.3.3 3\. 资源统计

cgroup 会帮你统计整个组的资源使用情况，你可以很方便地知道一组进程用了多少 CPU、多少内存、多少 IO，用来做监控。

### 1.3.4 4\. 进程隔离

cgroup 可以把进程隔离开，不同的组之间互不影响，这就是容器技术的核心：Docker、Kubernetes 就是用 cgroup 来隔离容器的资源的。

你平时用 Docker 的时候，`docker run --cpus=0.5 --memory=1g`，其实就是底层创建了一个 cgroup，设置了这些限制！

---

## 1.4 四、实践操作：手把手教你用 cgroup

接下来，我们来动手实践，一步步教你怎么用 cgroup 来管理资源。

我们先讲 **cgroup v2** 的用法，因为新系统都是这个，然后再讲 v1 的兼容用法。

### 1.4.1 4\.1 手动操作 cgroup v2

手动操作 cgroup 其实很简单，就是操作 `/sys/fs/cgroup` 下面的文件，cgroup 把接口暴露成了文件系统，你读写这些文件就能配置了。

#### 1.4.1.1 步骤 1：创建你的 cgroup 分组

首先，创建一个目录，就是你的分组：

```bash
sudo mkdir /sys/fs/cgroup/my_task
```

#### 1.4.1.2 步骤 2：启用你需要的控制器

然后，你要告诉系统，这个分组要启用哪些控制器，比如我们要控制 CPU、内存、IO：

```bash
# + 表示启用，- 表示禁用
sudo sh -c 'echo "+cpu +memory +io" > /sys/fs/cgroup/my_task/cgroup.subtree_control'
```

#### 1.4.1.3 步骤 3：配置资源限制

现在，我们来设置各种资源的限制：

##### 1.4.1.3.1 限制 CPU 使用率

我们想让这个组的任务，最多用 50% 的 CPU 核心：

```bash
# cpu.max 的格式是 配额/周期，单位是微秒
# 100000 微秒就是 100ms，是默认的周期
# 所以 50000 就是，每 100ms 里，最多用 50ms 的 CPU，也就是 50% 的使用率
sudo sh -c 'echo 50000 > /sys/fs/cgroup/my_task/cpu.max'
```

> 如果你有多个 CPU 核心，比如 4 核，你想让它最多用 2 个核心，那就是 `200000`，因为 2 \* 100000 = 200000。

##### 1.4.1.3.2 限制内存使用

我们想让这个组的任务，最多用 1G 的内存，超过了就会被 OOM kill：

```bash
sudo sh -c 'echo 1G > /sys/fs/cgroup/my_task/memory.max'
```

除了硬限制，还有软限制：

```bash
# 软限制：内存紧张的时候，优先回收这个组的内存
sudo sh -c 'echo 900M > /sys/fs/cgroup/my_task/memory.high'

# 最小保证：系统最少给这个组留这么多内存，内存紧张的时候优先保障它
sudo sh -c 'echo 500M > /sys/fs/cgroup/my_task/memory.low'
```

##### 1.4.1.3.3 限制磁盘 IO 速度

我们想限制这个组的磁盘读写速度，最多 1M/s，防止备份的时候把硬盘打满：

首先，你要知道你的磁盘的 major:minor 号，用 `lsblk` 就能看到：

```bash
lsblk
# 输出比如：
# sda      8:0    0 238.5G  0 disk
```

这里的 `8:0` 就是 sda 的设备号。

然后设置 IO 限制：

```bash
# 限制 sda 的读写速度，最多 1M/s
sudo sh -c 'echo "8:0 rbps=1048576 wbps=1048576" > /sys/fs/cgroup/my_task/io.max'
```

> 1048576 就是 1M 的字节数，你要限制到 10M 就改成 10485760。

##### 1.4.1.3.4 限制进程数量

防止 fork 炸弹，限制这个组最多有 100 个进程：

```bash
sudo sh -c 'echo 100 > /sys/fs/cgroup/my_task/pids.max'
```

#### 1.4.1.4 步骤 4：把进程加入到组里

现在，我们把当前的 shell 加入到这个组里，这样我们在这个 shell 里跑的所有进程，都会被这些限制管着：

```bash
# $$ 就是当前 shell 的 PID
sudo sh -c "echo $$ > /sys/fs/cgroup/my_task/cgroup.procs"
```

> 你也可以把其他进程的 PID 写进去，比如把 PID 1234 加进去：
> `echo 1234 > /sys/fs/cgroup/my_task/cgroup.procs`

#### 1.4.1.5 步骤 5：测试！

现在，你可以在这个 shell 里跑任务了，比如跑个 CPU 压力测试：

```bash
# 安装压力测试工具
sudo apt install stress-ng

# 跑 CPU 压力
stress-ng -c 1
```

然后你开另一个终端，看 top，你会发现，这个进程的 CPU 使用率最多就是 50%！不会超过我们设置的限制！

完美！这就是 cgroup 的效果。

#### 1.4.1.6 步骤 6：清理

用完了之后，要删除这个 cgroup，首先要把里面的进程移出来，或者 kill 掉，然后删除目录：

```bash
# 把进程移到根组，这样就能删了
sudo sh -c "echo $$ > /sys/fs/cgroup/cgroup.procs"

# 删除 cgroup 目录
sudo rmdir /sys/fs/cgroup/my_task
```

---

### 1.4.2 4\.2 更简单的方法：用 systemd slice

手动操作 sysfs 有点麻烦，有没有更简单的方法？

当然有！现在的系统都用 systemd，它已经帮你封装好了 cgroup 的操作，你用一条命令就能搞定！

比如，我们想创建一个受限的 shell，限制 CPU 50%，内存 1G：

```bash
sudo systemd-run --slice=my_task.slice --property=CPUQuota=50% --property=MemoryMax=1G bash
```

就这一条命令！systemd 会自动帮你创建 cgroup，设置好限制，然后给你开一个新的 bash，你在这个 bash 里跑的所有进程，都会被限制！

是不是超级简单？不用记那些 sysfs 的路径了！

你还可以设置 IO 限制、进程数限制：

```bash
sudo systemd-run --slice=my_task.slice \
  --property=CPUQuota=50% \
  --property=MemoryMax=1G \
  --property=IOReadBandwidthMax="/dev/sda 1M" \
  --property=IOWriteBandwidthMax="/dev/sda 1M" \
  --property=TasksMax=100 \
  bash
```

太方便了！这才是平时我们用的方法，不用手动搞那些文件。

---

### 1.4.3 4\.3 兼容旧系统：cgroup v1 的用法

如果你的系统比较旧，还是用的 cgroup v1，操作稍微有点不一样，我也给你列出来：

```bash
# 1. 创建各个控制器的分组
sudo mkdir /sys/fs/cgroup/cpu/my_task
sudo mkdir /sys/fs/cgroup/memory/my_task
sudo mkdir /sys/fs/cgroup/blkio/my_task

# 2. 设置 CPU 限制（v1 用的是 cpu.cfs_quota_us）
sudo sh -c 'echo 50000 > /sys/fs/cgroup/cpu/my_task/cpu.cfs_quota_us'
sudo sh -c 'echo 100000 > /sys/fs/cgroup/cpu/my_task/cpu.cfs_period_us'

# 3. 设置内存限制
sudo sh -c 'echo 1073741824 > /sys/fs/cgroup/memory/my_task/memory.limit_in_bytes'

# 4. 设置 IO 限制
sudo sh -c 'echo "8:0 1048576" > /sys/fs/cgroup/blkio/my_task/blkio.read_bps_device'
sudo sh -c 'echo "8:0 1048576" > /sys/fs/cgroup/blkio/my_task/blkio.write_bps_device'

# 5. 把进程加进去
sudo sh -c "echo $$ > /sys/fs/cgroup/cpu/my_task/tasks"
sudo sh -c "echo $$ > /sys/fs/cgroup/memory/my_task/tasks"
sudo sh -c "echo $$ > /sys/fs/cgroup/blkio/my_task/tasks"
```

v1 因为每个控制器是独立的，所以你要把进程加到每个控制器的组里，有点麻烦，这也是为什么 v2 更好的原因。

---

## 1.5 五、进阶用法：cgroup 的高级功能

### 1.5.1 5\.1 冻结 / 解冻进程组

你可以把整个 cgroup 的所有进程都冻结，暂停它们，然后需要的时候再解冻，这个太有用了！

比如，你要备份数据，怕进程在备份的时候改数据，就可以先把它们冻结，备份完了再解冻：

```bash
# 冻结所有进程
sudo sh -c 'echo frozen > /sys/fs/cgroup/my_task/cgroup.freeze'

# 查看状态
cat /sys/fs/cgroup/my_task/cgroup.freeze
# 输出 frozen

# 解冻
sudo sh -c 'echo thaw > /sys/fs/cgroup/my_task/cgroup.freeze'
```

### 1.5.2 5\.2 资源压力监控（PSI）

cgroup v2 带来了一个非常有用的功能：PSI（Pressure Stall Information），它能告诉你系统的资源压力，也就是有多少时间，任务在等待资源。

比如，你可以看：

```bash
# 查看 CPU 压力
cat /sys/fs/cgroup/my_task/cpu.pressure
# 输出：some avg10=0.00 avg60=0.00 avg300=0.00 total=0
#        full avg10=0.00 avg60=0.00 avg300=0.00 total=0

# 查看内存压力
cat /sys/fs/cgroup/my_task/memory.pressure

# 查看 IO 压力
cat /sys/fs/cgroup/my_task/io.pressure
```

这个可以帮你判断，你的任务是不是在等资源，系统是不是过载了。

### 1.5.3 5\.3 资源统计

cgroup 会帮你统计所有的资源使用情况，你可以很方便地监控：

```bash
# CPU 统计
cat /sys/fs/cgroup/my_task/cpu.stat

# 内存统计
cat /sys/fs/cgroup/my_task/memory.stat

# IO 统计
cat /sys/fs/cgroup/my_task/io.stat

# 进程数统计
cat /sys/fs/cgroup/my_task/pids.stat
```

---

## 1.6 六、实际场景：怎么用 cgroup 解决你的问题？

### 1.6.1 场景 1：限制编译任务的资源

你要编译一个大项目，但是不想让它占满 CPU，影响线上的服务：

```bash
# 用 systemd 开一个受限的 shell，CPU 限制到 2 核，内存 4G
sudo systemd-run --slice=build.slice --property=CPUQuota=200% --property=MemoryMax=4G bash

# 然后在这个 shell 里跑编译
make -j8
```

这样，编译最多用 2 个 CPU，不会影响其他服务。

### 1.6.2 场景 2：限制备份任务的 IO

你要跑备份，但是不想让备份的 IO 把硬盘打满，影响线上的数据库：

```bash
sudo systemd-run --slice=backup.slice --property=IOWriteBandwidthMax="/dev/sda 50M" bash

# 然后在这个 shell 里跑备份
tar zcf backup.tar.gz /data
```

这样，备份的写速度最多 50M/s，不会影响数据库。

### 1.6.3 场景 3：防止 fork 炸弹

你要跑一个不可信的脚本，怕它搞 fork 炸弹：

```bash
sudo systemd-run --slice=untrusted.slice --property=TasksMax=100 bash

# 然后在这个 shell 里跑脚本
./untrusted_script.sh
```

就算它想 fork 炸弹，最多 fork 100 个进程，不会搞挂系统。

### 1.6.4 场景 4：Docker 容器的资源限制

你平时用 Docker 的时候，其实就是用的 cgroup：

```bash
docker run --cpus=0.5 --memory=1g nginx
```

这行命令，就是 Docker 底层创建了一个 cgroup，限制了 CPU 50%，内存 1G，和我们刚才手动做的是一样的！

---

## 1.7 七、常见问题

### 1.7.1 1\. 为什么我删除 cgroup 的时候提示 Device or resource busy？

因为你的 cgroup 里还有进程！你要先把里面的进程都移出来，或者 kill 掉，才能删除：

```bash
# 把进程移到根组
sudo sh -c "echo 你的PID > /sys/fs/cgroup/cgroup.procs"
# 然后再删
sudo rmdir /sys/fs/cgroup/my_task
```

### 1.7.2 2\. 我把进程加到 cgroup 里，它的子进程会自动加进去吗？

会的！只要你在 cgroup 里 fork 子进程，子进程会自动继承父进程的 cgroup，不用你手动加。

### 1.7.3 3\. cgroup 的限制是针对单个进程还是整个组？

整个组！所有在这个组里的进程，加起来的资源总和，不能超过你的限制，这就是 cgroup 最核心的价值，它是组级别的限制，而不是单个进程的。

---

## 1.8 总结

cgroup 是 Linux 系统管理资源的神器，它是容器技术的核心，也是系统管理员的利器。

通过这篇文章，你已经学会了：

- cgroup 的基础概念和版本区别

- 怎么用 cgroup 限制 CPU、内存、IO、进程数

- 手动操作的方法，还有更简单的 systemd 方法

- 进阶的冻结、监控功能

- 实际场景的用法

现在，你已经可以熟练用 cgroup 来管理你的系统资源了，再也不用担心某个任务把系统搞挂了！