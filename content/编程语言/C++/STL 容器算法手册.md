# 1 C++ STL 容器与算法手册

## 1.1 全局概览

### 1.1.1 容器分类导图

```
STL 容器
├── 序列容器（Sequence Containers）       ← 元素有顺序，按位置访问
│   ├── array          固定大小数组
│   ├── vector         动态数组
│   ├── deque          双端队列
│   ├── list           双向链表
│   └── forward_list   单向链表
│
├── 关联容器（Associative Containers）    ← 按键自动排序，红黑树实现
│   ├── set            有序不重复集合
│   ├── multiset       有序可重复集合
│   ├── map            有序键值对
│   └── multimap       有序可重复键值对
│
├── 无序关联容器（Unordered Associative） ← 哈希表实现，O(1) 平均
│   ├── unordered_set
│   ├── unordered_multiset
│   ├── unordered_map
│   └── unordered_multimap
│
└── 容器适配器（Container Adaptors）     ← 对其他容器的封装
    ├── stack          后进先出
    ├── queue          先进先出
    └── priority_queue 优先队列（堆）
```

### 1.1.2 选择容器的第一原则

```
需要什么操作最快？
│
├── 随机访问（下标）          → vector / array / deque
├── 头尾插入                  → deque
├── 中间频繁插入删除          → list / forward_list
├── 按键查找（有序）          → map / set
├── 按键查找（无序，更快）    → unordered_map / unordered_set
├── 去重                      → set / unordered_set
├── 后进先出                  → stack
├── 先进先出                  → queue
└── 最大/最小优先             → priority_queue
```

### 1.1.3 复杂度速查总表

|容器|随机访问|头部插删|尾部插删|中间插删|查找|
|---|---|---|---|---|---|
|`array`|O(1)|O(n)|O(n)|O(n)|O(n)|
|`vector`|O(1)|O(n)|O(1)均摊|O(n)|O(n)|
|`deque`|O(1)|O(1)|O(1)|O(n)|O(n)|
|`list`|O(n)|O(1)|O(1)|O(1)*|O(n)|
|`forward_list`|O(n)|O(1)|O(n)|O(1)*|O(n)|
|`set/map`|—|—|—|O(log n)|O(log n)|
|`unordered_set/map`|—|—|—|O(1)均摊|O(1)均摊|

*list 中间插删需要先 O(n) 找到位置，持有迭代器时才是 O(1)

---

## 1.2 array —— 固定大小数组

### 1.2.1 基本特性

```cpp
#include <array>
std::array<int, 5> arr = {1, 2, 3, 4, 5};
```

- 大小在**编译期固定**，不能动态增减
- 内存连续，无额外开销（等同于 C 数组）
- 与 C 数组不同：不会退化为指针，有 `size()`，可以被拷贝和赋值

### 1.2.2 核心操作

```cpp
std::array<int, 5> arr = {1, 2, 3, 4, 5};

// 访问
arr[2];            // 下标访问，不检查越界
arr.at(2);         // 越界抛 std::out_of_range
arr.front();       // 第一个元素
arr.back();        // 最后一个元素
arr.data();        // 裸指针（传给 C 接口）

// 大小
arr.size();        // 5（编译期常量）
arr.empty();       // false
arr.max_size();    // 5

// 修改
arr.fill(0);       // 全部填充为 0
arr1.swap(arr2);   // 交换两个同类型 array

// 比较（字典序）
arr1 == arr2;
arr1 < arr2;
```

### 1.2.3 可用算法

`array` 支持几乎所有接受随机访问迭代器的算法：

```cpp
std::array<int, 5> arr = {3, 1, 4, 1, 5};

// 排序
std::sort(arr.begin(), arr.end());
std::sort(arr.begin(), arr.end(), std::greater<int>());  // 降序

// 查找
auto it = std::find(arr.begin(), arr.end(), 4);
auto it = std::lower_bound(arr.begin(), arr.end(), 3);   // 二分（有序时）
bool found = std::binary_search(arr.begin(), arr.end(), 3);

// 统计
int cnt = std::count(arr.begin(), arr.end(), 1);
auto [min, max] = std::minmax_element(arr.begin(), arr.end());
int sum = std::accumulate(arr.begin(), arr.end(), 0);

// 变换
std::transform(arr.begin(), arr.end(), arr.begin(),
               [](int x) { return x * 2; });
std::fill(arr.begin(), arr.end(), 0);
std::reverse(arr.begin(), arr.end());
std::rotate(arr.begin(), arr.begin() + 2, arr.end());  // 左移2位
```

### 1.2.4 常见使用场景

```cpp
// 场景1：固定大小的查找表（编译期确定）
constexpr std::array<const char*, 7> weekdays = {
    "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"
};
std::cout << weekdays[day_index];

// 场景2：多维固定矩阵
std::array<std::array<int, 3>, 3> matrix = {{{1,0,0},{0,1,0},{0,0,1}}};

// 场景3：替代 C 数组传给函数（避免退化为指针）
void process(std::array<int, 4>& arr) {  // 大小是类型的一部分，编译期检查
    // arr.size() 永远是 4
}

// 场景4：枚举映射（索引即枚举值）
enum class Color { Red, Green, Blue, COUNT };
std::array<std::string, 3> color_names = {"Red", "Green", "Blue"};
```

---

## 1.3 vector —— 动态数组（最常用容器）

### 1.3.1 基本特性

```cpp
#include <vector>
std::vector<int> v = {1, 2, 3};
```

- 内存**连续**，随机访问 O(1)
- 尾部插入 O(1) 均摊（扩容时复制）
- 头部/中间插入 O(n)（需要移动元素）
- 扩容时所有迭代器失效

### 1.3.2 核心操作

```cpp
std::vector<int> v;

// 构造
std::vector<int> v1(5);          // 5个0
std::vector<int> v2(5, 42);      // 5个42
std::vector<int> v3 = {1,2,3};   // 初始化列表

// 添加元素
v.push_back(10);                  // 尾部追加（拷贝）
v.emplace_back(10);               // 尾部构造（直接构造，推荐）
v.insert(v.begin() + 2, 99);     // 位置2插入
v.insert(v.end(), {4,5,6});      // 插入多个

// 删除
v.pop_back();                     // 删除最后一个
v.erase(v.begin() + 2);          // 删除位置2
v.erase(v.begin(), v.begin()+3); // 删除范围
v.clear();                        // 清空

// 访问
v[2];            // 下标，不检查
v.at(2);         // 越界抛异常
v.front();       // 第一个
v.back();        // 最后一个
v.data();        // 裸指针

// 大小与容量
v.size();        // 元素个数
v.capacity();    // 已分配容量
v.empty();       // 是否为空
v.resize(10);    // 调整大小（多出的填0）
v.resize(10,42); // 多出的填42
v.reserve(100);  // 预分配容量（不改变 size）
v.shrink_to_fit(); // 释放多余容量

// 删除 erase-remove 惯用法（高效删除所有满足条件的元素）
v.erase(std::remove(v.begin(), v.end(), 3), v.end());  // 删除所有3
v.erase(std::remove_if(v.begin(), v.end(),
        [](int x){ return x % 2 == 0; }), v.end());    // 删除所有偶数

// C++20 简化版
std::erase(v, 3);                               // 删除所有3
std::erase_if(v, [](int x){ return x%2==0; }); // 删除所有偶数
```

### 1.3.3 可用算法（最全）

vector 支持所有标准算法（连续内存，随机访问迭代器）：

```cpp
std::vector<int> v = {5, 2, 8, 1, 9, 3, 7, 4, 6};

// ── 排序 ──────────────────────────────────────────────
std::sort(v.begin(), v.end());                    // 升序
std::sort(v.begin(), v.end(), std::greater<>());  // 降序
std::stable_sort(v.begin(), v.end());             // 稳定排序
std::partial_sort(v.begin(), v.begin()+3, v.end()); // 前3个有序
std::nth_element(v.begin(), v.begin()+4, v.end()); // 第5个归位

// ── 查找 ──────────────────────────────────────────────
auto it = std::find(v.begin(), v.end(), 8);
auto it = std::find_if(v.begin(), v.end(), [](int x){ return x>6; });
bool has = std::any_of(v.begin(), v.end(), [](int x){ return x>8; });
bool all = std::all_of(v.begin(), v.end(), [](int x){ return x>0; });
bool none= std::none_of(v.begin(), v.end(), [](int x){ return x<0; });

// 二分查找（有序时）
auto it = std::lower_bound(v.begin(), v.end(), 5); // 第一个 >= 5
auto it = std::upper_bound(v.begin(), v.end(), 5); // 第一个 > 5
auto [lo,hi] = std::equal_range(v.begin(), v.end(), 5); // 等于5的范围
bool found = std::binary_search(v.begin(), v.end(), 5);

// ── 统计 ──────────────────────────────────────────────
int cnt = std::count(v.begin(), v.end(), 5);
int cnt = std::count_if(v.begin(), v.end(), [](int x){ return x>5; });
auto it = std::min_element(v.begin(), v.end());
auto it = std::max_element(v.begin(), v.end());
auto [mn, mx] = std::minmax_element(v.begin(), v.end());
int sum = std::accumulate(v.begin(), v.end(), 0);
int prod= std::accumulate(v.begin(), v.end(), 1, std::multiplies<int>());
int dot = std::inner_product(a.begin(), a.end(), b.begin(), 0); // 点积

// ── 变换 ──────────────────────────────────────────────
std::transform(v.begin(), v.end(), v.begin(),
               [](int x){ return x*2; });          // 原地变换
std::transform(a.begin(), a.end(), b.begin(), c.begin(),
               std::plus<int>());                   // 两个容器相加

// ── 填充与生成 ────────────────────────────────────────
std::fill(v.begin(), v.end(), 0);
std::fill_n(v.begin(), 3, 99);
std::iota(v.begin(), v.end(), 1);      // 填充 1,2,3,...
std::generate(v.begin(), v.end(), rand); // 用函数生成

// ── 重排 ──────────────────────────────────────────────
std::reverse(v.begin(), v.end());
std::rotate(v.begin(), v.begin()+2, v.end()); // 左移2位
std::shuffle(v.begin(), v.end(), std::mt19937{std::random_device{}()});
std::next_permutation(v.begin(), v.end());    // 下一个排列
std::prev_permutation(v.begin(), v.end());    // 上一个排列

// ── 删除/过滤 ─────────────────────────────────────────
auto new_end = std::remove(v.begin(), v.end(), 5);      // 逻辑删除
auto new_end = std::remove_if(v.begin(), v.end(), pred);
auto new_end = std::unique(v.begin(), v.end());         // 去重相邻

// ── 集合操作（需要有序） ──────────────────────────────
std::set_union(a.begin(), a.end(), b.begin(), b.end(),
               std::back_inserter(result));
std::set_intersection(...);
std::set_difference(...);
std::set_symmetric_difference(...);
std::merge(a.begin(), a.end(), b.begin(), b.end(),
           std::back_inserter(result));           // 合并有序序列

// ── 堆操作 ────────────────────────────────────────────
std::make_heap(v.begin(), v.end());               // 建堆（大根堆）
std::push_heap(v.begin(), v.end());               // 新元素入堆
std::pop_heap(v.begin(), v.end());                // 堆顶移至末尾
std::sort_heap(v.begin(), v.end());               // 堆排序

// ── 拷贝 ──────────────────────────────────────────────
std::copy(v.begin(), v.end(), dest.begin());
std::copy_if(v.begin(), v.end(), std::back_inserter(dest),
             [](int x){ return x>3; });
std::copy_n(v.begin(), 3, dest.begin());

// ── 前缀和/相邻差 ─────────────────────────────────────
std::partial_sum(v.begin(), v.end(), result.begin()); // 前缀和
std::adjacent_difference(v.begin(), v.end(), result.begin()); // 相邻差
std::inclusive_scan(v.begin(), v.end(), result.begin()); // C++17
std::exclusive_scan(v.begin(), v.end(), result.begin(), 0); // C++17
```

### 1.3.4 常见使用场景

```cpp
// 场景1：动态数组，大多数情况的默认选择
std::vector<std::string> names;
names.reserve(1000);  // 预知大小时提前 reserve，避免多次扩容
for (auto& line : lines) names.push_back(line);

// 场景2：作为函数返回的集合
std::vector<int> get_prime_numbers(int n) {
    std::vector<bool> sieve(n+1, true);
    std::vector<int> primes;
    for (int i = 2; i <= n; i++)
        if (sieve[i]) {
            primes.push_back(i);
            for (int j = 2*i; j <= n; j += i) sieve[j] = false;
        }
    return primes;  // NRVO，无拷贝
}

// 场景3：排序后去重
std::vector<int> v = {3,1,4,1,5,9,2,6,5,3};
std::sort(v.begin(), v.end());
v.erase(std::unique(v.begin(), v.end()), v.end());
// v = {1,2,3,4,5,6,9}

// 场景4：二维矩阵
std::vector<std::vector<int>> matrix(rows, std::vector<int>(cols, 0));

// 场景5：替代 new[]/delete[] 管理动态数组
std::vector<char> buffer(4096);  // 自动管理，比 new char[4096] 安全
read(fd, buffer.data(), buffer.size());
```

---

## 1.4 deque —— 双端队列

### 1.4.1 基本特性

```cpp
#include <deque>
std::deque<int> dq = {1, 2, 3};
```

- 头尾插入删除均为 O(1)
- 随机访问 O(1)（但常数比 vector 大）
- 内存**不连续**（分块存储），没有 `data()` 接口
- 扩容时迭代器会失效，但不像 vector 那样移动所有元素

### 1.4.2 核心操作

```cpp
std::deque<int> dq;

dq.push_back(1);    // 尾部插入
dq.push_front(0);   // 头部插入（vector 没有这个！）
dq.emplace_back(1);
dq.emplace_front(0);

dq.pop_back();      // 删除尾部
dq.pop_front();     // 删除头部

dq[2];              // 随机访问
dq.at(2);
dq.front();
dq.back();

// 其余操作与 vector 基本一致：insert/erase/resize/size/empty/clear
```

### 1.4.3 常见使用场景

```cpp
// 场景1：滑动窗口（两端都需要操作）
std::deque<int> window;
for (int i = 0; i < n; i++) {
    window.push_back(arr[i]);          // 新元素入窗口尾
    if (window.size() > k)
        window.pop_front();            // 超出窗口大小，移除头部
    // 对 window 做统计
}

// 场景2：BFS 广度优先搜索（queue 的底层默认是 deque）
std::deque<Node*> bfs_queue;
bfs_queue.push_back(root);
while (!bfs_queue.empty()) {
    Node* node = bfs_queue.front();
    bfs_queue.pop_front();
    for (auto* child : node->children)
        bfs_queue.push_back(child);
}

// 场景3：需要随机访问又需要头部插入的场景
// （vector 头部插入是 O(n)，deque 是 O(1)）
std::deque<Task> task_list;
task_list.push_front(urgent_task);  // 紧急任务插队到头部
task_list.push_back(normal_task);   // 普通任务加到尾部
```

---

## 1.5 list —— 双向链表

### 1.5.1 基本特性

```cpp
#include <list>
std::list<int> lst = {1, 2, 3, 4, 5};
```

- 持有迭代器时，任意位置插入删除 O(1)
- **不支持随机访问**（没有 `[]` 运算符）
- 内存不连续，cache 不友好，实际使用比想象中慢
- 插入/删除操作不会使其他迭代器失效（这是 list 最大的优势）

### 1.5.2 核心操作

```cpp
std::list<int> lst = {1, 2, 3, 4, 5};

// 插入删除（在已有迭代器处 O(1)）
auto it = std::find(lst.begin(), lst.end(), 3);
lst.insert(it, 99);     // 在3前面插入99
lst.erase(it);          // 删除3（it 仍有效，指向下一个元素）

// list 专有操作（vector/deque 没有）
lst.splice(it, other_lst);           // 把 other_lst 整体接到 it 前
lst.splice(it, other_lst, it2);      // 把 other_lst 中 it2 指向的元素移过来
lst.splice(it, other_lst, b, e);     // 移动范围

lst.remove(3);                       // 删除所有值为3的元素
lst.remove_if([](int x){ return x%2==0; }); // 删除所有偶数

lst.unique();                        // 删除相邻重复元素
lst.sort();                          // list 自己的排序（std::sort 不支持链表）
lst.reverse();                       // 就地反转
lst.merge(other_lst);               // 合并两个有序链表
```

### 1.5.3 注意：不能用 std::sort

```cpp
// std::sort 需要随机访问迭代器，list 不支持
std::sort(lst.begin(), lst.end());  // ❌ 编译错误

// 必须用 list 的成员函数 sort
lst.sort();                         // ✅ 链表版归并排序
lst.sort(std::greater<int>());      // ✅ 降序
```

### 1.5.4 常见使用场景

```cpp
// 场景1：LRU 缓存（需要 O(1) 移动任意元素到头部）
class LRUCache {
    std::list<std::pair<int,int>> cache;  // 最近用的在头部
    std::unordered_map<int, std::list<std::pair<int,int>>::iterator> map;
    int cap;
public:
    int get(int key) {
        auto it = map.find(key);
        if (it == map.end()) return -1;
        cache.splice(cache.begin(), cache, it->second);  // O(1) 移到头部
        return it->second->second;
    }
    void put(int key, int val) {
        if (map.count(key)) cache.erase(map[key]);
        else if (cache.size() == cap) {
            map.erase(cache.back().first);
            cache.pop_back();
        }
        cache.push_front({key, val});
        map[key] = cache.begin();
    }
};

// 场景2：需要稳定迭代器的对象列表
// （insert/erase 不会使其他迭代器失效）
std::list<Task> tasks;
// 可以安全地在遍历时修改其他位置的元素
for (auto it = tasks.begin(); it != tasks.end(); ) {
    if (it->is_done())
        it = tasks.erase(it);  // erase 返回下一个有效迭代器
    else
        ++it;
}

// 场景3：高效合并多个有序链表（splice 零拷贝）
std::list<int> a = {1, 3, 5};
std::list<int> b = {2, 4, 6};
a.merge(b);  // a = {1,2,3,4,5,6}，b 被清空，O(n) 且无内存分配
```

---

## 1.6 forward_list —— 单向链表

### 1.6.1 基本特性

```cpp
#include <forward_list>
std::forward_list<int> fl = {1, 2, 3};
```

- 比 `list` 少一个指针，内存开销更小
- 只能前向遍历
- 没有 `size()` 方法（O(1) 无法实现，故去掉）
- 插入删除接口与 list 略有不同（`insert_after`/`erase_after`）

### 1.6.2 核心操作

```cpp
std::forward_list<int> fl = {1, 2, 3};

fl.push_front(0);        // 头部插入
fl.pop_front();          // 头部删除
fl.front();              // 第一个元素

// 注意：是 insert_after/erase_after，不是 insert/erase
auto it = fl.before_begin();  // 哨兵迭代器，指向第一个元素之前
fl.insert_after(it, 99);      // 在 it 指向位置的后面插入
fl.erase_after(it);           // 删除 it 指向位置的下一个元素

// 其他操作和 list 类似
fl.remove(3);
fl.remove_if(...);
fl.sort();
fl.reverse();
fl.merge(other);
fl.splice_after(it, other);
```

### 1.6.3 常见使用场景

```cpp
// 主要场景：内存敏感场合的链表，比 list 节省一个指针
// 每个节点 list 用 16 字节（data + prev + next），forward_list 只用 8+4=12 字节

// 场景：单向遍历的简单队列，且节点数量极大
std::forward_list<Event> event_queue;
event_queue.push_front(new_event);
// 处理完就 pop，不需要反向遍历

// 场景：实现邻接链表（图的存储）
std::vector<std::forward_list<int>> adj(n);  // n 个节点的邻接链表
adj[u].push_front(v);  // 添加边
for (int neighbor : adj[u]) { ... }  // 遍历邻居
```

---

## 1.7 set / multiset —— 有序集合

### 1.7.1 基本特性

```cpp
#include <set>
std::set<int> s = {3, 1, 4, 1, 5, 9};  // 自动去重并排序
// s 内容：{1, 3, 4, 5, 9}

std::multiset<int> ms = {3, 1, 4, 1, 5};  // 允许重复
// ms 内容：{1, 1, 3, 4, 5}
```

- 红黑树实现，元素**自动有序**
- 插入/删除/查找均 O(log n)
- 迭代器不失效（insert/erase 不影响其他迭代器）
- `set` 自动去重，`multiset` 允许重复

### 1.7.2 核心操作

```cpp
std::set<int> s = {3, 1, 4, 5, 9};

// 插入
s.insert(6);
s.insert({7, 8});         // 插入多个
s.emplace(10);

// 删除
s.erase(3);               // 按值删除（删除所有等于3的，multiset中可能有多个）
s.erase(s.find(3));       // 按迭代器删除（multiset中只删一个）
s.erase(s.begin(), s.end()); // 范围删除

// 查找
auto it = s.find(4);      // 找不到返回 s.end()
bool has = s.count(4);    // set中 count 返回 0 或 1
bool has = s.contains(4); // C++20，更直观

// 范围查找（利用有序性）
auto it = s.lower_bound(3);  // 第一个 >= 3 的迭代器
auto it = s.upper_bound(3);  // 第一个 > 3 的迭代器
auto [lo, hi] = s.equal_range(3);  // 等于3的范围

// 大小
s.size();
s.empty();

// 遍历（自动按升序）
for (int x : s) std::cout << x;  // 1 3 4 5 9

// 自定义排序（降序）
std::set<int, std::greater<int>> desc_set;

// 自定义比较器
struct CmpByAbs {
    bool operator()(int a, int b) const { return std::abs(a) < std::abs(b); }
};
std::set<int, CmpByAbs> abs_set;
```

### 1.7.3 可用算法

```cpp
std::set<int> s = {1, 3, 5, 7, 9};

// set 只支持双向迭代器，不支持随机访问
// 不能用：std::sort（已排序，不需要）、std::shuffle

// 可以用
std::for_each(s.begin(), s.end(), [](int x){ ... });
auto it = std::find(s.begin(), s.end(), 5);        // 但效率不如 s.find()
int cnt = std::count(s.begin(), s.end(), 5);
std::copy(s.begin(), s.end(), std::back_inserter(v));

// 集合算法（利用 set 有序性）
std::set_union(s1.begin(), s1.end(), s2.begin(), s2.end(),
               std::inserter(result, result.begin()));
std::set_intersection(s1.begin(), s1.end(), s2.begin(), s2.end(),
                      std::inserter(result, result.begin()));
std::set_difference(...);
std::includes(s1.begin(), s1.end(), s2.begin(), s2.end()); // s2 是否是 s1 的子集
```

### 1.7.4 常见使用场景

```cpp
// 场景1：维护有序唯一元素集合
std::set<int> unique_ids;
unique_ids.insert(new_id);
if (unique_ids.count(id)) { /* 已存在 */ }

// 场景2：找第 K 小的元素（结合 lower_bound）
// 注意：set 没有 O(1) 的 operator[]，advance 是 O(n)
auto it = s.begin();
std::advance(it, k-1);  // 第 k 小，O(n)

// 场景3：区间查询（某个范围内的所有元素）
auto lo = s.lower_bound(10);
auto hi = s.upper_bound(20);
for (auto it = lo; it != hi; ++it)
    std::cout << *it;  // 打印 [10, 20] 内所有元素

// 场景4：去重并保持有序
std::vector<int> v = {3, 1, 4, 1, 5, 9, 2, 6};
std::set<int> s(v.begin(), v.end());  // 自动去重+排序

// 场景5：multiset 统计频率并排序输出
std::multiset<int> ms;
for (int x : data) ms.insert(x);
std::cout << ms.count(5);  // 5 出现的次数

// 场景6：滑动窗口维护有序集合
std::multiset<int> window;
for (int i = 0; i < n; i++) {
    window.insert(arr[i]);
    if (i >= k) window.erase(window.find(arr[i-k]));  // 注意用 find 而不是值
    // 获取中位数
    auto it = window.begin();
    std::advance(it, k/2);
    int median = *it;
}
```

---

## 1.8 map / multimap —— 有序键值对

### 1.8.1 基本特性

```cpp
#include <map>
std::map<std::string, int> scores;
```

- 红黑树实现，按**键**自动排序
- 键唯一（`map`）或可重复（`multimap`）
- 插入/删除/查找均 O(log n)
- `operator[]` 会在键不存在时**自动插入**默认值（注意副作用！）

### 1.8.2 核心操作

```cpp
std::map<std::string, int> m;

// 插入
m["alice"] = 90;               // operator[]：不存在则插入，存在则更新
m.insert({"bob", 85});         // 插入，键存在时不更新
m.insert_or_assign("bob", 88); // 插入或更新（C++17）
m.emplace("charlie", 95);
auto [it, ok] = m.insert({"alice", 100});  // ok=false，alice已存在

// 访问
m["alice"];                    // 90，不存在时插入0（副作用！）
m.at("alice");                 // 90，不存在时抛异常
auto it = m.find("alice");     // 返回迭代器
if (it != m.end()) it->second; // 安全访问

// 删除
m.erase("alice");
m.erase(m.find("alice"));

// 查找
bool has = m.count("alice");   // 0 或 1
bool has = m.contains("alice"); // C++20
auto it = m.find("alice");

// 范围查找
auto lo = m.lower_bound("b");  // 第一个键 >= "b"
auto hi = m.upper_bound("d");  // 第一个键 > "d"

// 遍历（按键升序）
for (auto& [key, val] : m) {   // 结构化绑定（C++17）
    std::cout << key << ": " << val;
}

// 遍历旧写法
for (auto it = m.begin(); it != m.end(); ++it) {
    std::cout << it->first << ": " << it->second;
}
```

### 1.8.3 常见使用场景

```cpp
// 场景1：词频统计
std::map<std::string, int> freq;
for (const auto& word : words)
    freq[word]++;  // 不存在时自动初始化为0

// 场景2：按值排序（map 只能按键排序）
std::map<std::string, int> scores = {{"alice",90},{"bob",85},{"charlie",95}};
std::vector<std::pair<std::string,int>> sorted_scores(scores.begin(), scores.end());
std::sort(sorted_scores.begin(), sorted_scores.end(),
          [](const auto& a, const auto& b){ return a.second > b.second; });

// 场景3：范围查询（某个区间内的所有键值对）
std::map<int, std::string> timeline;
auto lo = timeline.lower_bound(2020);
auto hi = timeline.upper_bound(2024);
for (auto it = lo; it != hi; ++it)
    std::cout << it->first << ": " << it->second;

// 场景4：前缀匹配（利用有序性）
std::map<std::string, int> dict;
// 找所有以 "pre" 开头的键
auto lo = dict.lower_bound("pre");
auto hi = dict.lower_bound("prf");  // "pre" 的下一个前缀
for (auto it = lo; it != hi; ++it) { /* ... */ }

// 场景5：稀疏二维数组
std::map<std::pair<int,int>, double> sparse_matrix;
sparse_matrix[{i, j}] = value;

// 场景6：multimap 一键多值
std::multimap<std::string, std::string> email_book;
email_book.insert({"alice", "alice@work.com"});
email_book.insert({"alice", "alice@home.com"});
auto [lo, hi] = email_book.equal_range("alice");
for (auto it = lo; it != hi; ++it)
    std::cout << it->second;
```

---

## 1.9 unordered_map / unordered_set —— 哈希表

### 1.9.1 基本特性

```cpp
#include <unordered_map>
#include <unordered_set>

std::unordered_map<std::string, int> um;
std::unordered_set<int> us;
```

- 哈希表实现，**平均 O(1)** 插入/删除/查找
- 最坏 O(n)（哈希碰撞时），正常使用极少触发
- 元素**无序**（不保证遍历顺序）
- 比 map/set 快 3-10 倍（查找场景）
- 需要自定义哈希函数才能存储自定义类型

### 1.9.2 核心操作

```cpp
std::unordered_map<std::string, int> um;

// 操作接口与 map 几乎完全相同
um["key"] = 42;
um.insert({"key", 42});
um.insert_or_assign("key", 43);  // C++17
um.emplace("key", 42);

um.find("key");
um.count("key");
um.contains("key");   // C++20
um.erase("key");

// 哈希桶信息
um.bucket_count();    // 桶数量
um.load_factor();     // 负载因子（元素数/桶数）
um.max_load_factor(); // 最大负载因子（默认1.0）
um.rehash(100);       // 重新哈希，至少100个桶
um.reserve(1000);     // 预留空间（避免 rehash）
```

### 1.9.3 自定义类型的哈希

```cpp
// 方式1：特化 std::hash（推荐）
struct Point { int x, y; };

namespace std {
    template<>
    struct hash<Point> {
        size_t operator()(const Point& p) const {
            // 好的哈希：组合多个字段
            size_t h1 = std::hash<int>{}(p.x);
            size_t h2 = std::hash<int>{}(p.y);
            return h1 ^ (h2 << 32) ^ (h2 >> 32);  // 简单组合
            // 更好的组合方式（来自 Boost）：
            // return h1 ^ (h2 + 0x9e3779b9 + (h1<<6) + (h1>>2));
        }
    };
}
// 还需要定义 operator==
bool operator==(const Point& a, const Point& b) { return a.x==b.x && a.y==b.y; }

std::unordered_set<Point> points;

// 方式2：传入自定义哈希函数对象
struct PointHash {
    size_t operator()(const Point& p) const { ... }
};
struct PointEq {
    bool operator()(const Point& a, const Point& b) const { return a.x==b.x && a.y==b.y; }
};
std::unordered_set<Point, PointHash, PointEq> points;
```

### 1.9.4 常见使用场景

```cpp
// 场景1：O(1) 查找（最常见）
std::unordered_set<int> visited;
// DFS/BFS 中快速判断是否访问过
if (!visited.count(node)) {
    visited.insert(node);
    // 处理 node
}

// 场景2：词频统计（比 map 快）
std::unordered_map<std::string, int> freq;
for (const auto& word : words) freq[word]++;

// 场景3：两数之和（经典 LeetCode 问题）
std::unordered_map<int, int> seen;  // 值 → 下标
for (int i = 0; i < nums.size(); i++) {
    int complement = target - nums[i];
    if (seen.count(complement))
        return {seen[complement], i};
    seen[nums[i]] = i;
}

// 场景4：缓存/记忆化
std::unordered_map<int, long long> memo;
long long fib(int n) {
    if (n <= 1) return n;
    if (memo.count(n)) return memo[n];
    return memo[n] = fib(n-1) + fib(n-2);
}

// 场景5：分组（groupby）
std::unordered_map<std::string, std::vector<Student>> by_class;
for (auto& s : students)
    by_class[s.class_name].push_back(s);
```

### 1.9.5 map vs unordered_map 选择

|需求|选哪个|
|---|---|
|需要按键排序遍历|`map`|
|需要范围查询（lower_bound）|`map`|
|只需要查找/插入，追求速度|`unordered_map`|
|键是自定义类型，难以哈希|`map`|
|数据量大，查找是热路径|`unordered_map`|
|键是字符串或整数|`unordered_map`|

---

## 1.10 stack —— 后进先出

### 1.10.1 基本特性

```cpp
#include <stack>
std::stack<int> st;                     // 默认底层是 deque
std::stack<int, std::vector<int>> st;   // 指定底层是 vector（性能更好）
```

- 只暴露 `push`/`pop`/`top` 三个接口，强制 LIFO 语义
- 底层默认是 `deque`，但 `vector` 通常更快

### 1.10.2 核心操作

```cpp
std::stack<int> st;

st.push(1);       // 入栈
st.push(2);
st.emplace(3);    // 直接构造入栈

st.top();         // 查看栈顶（不弹出）
st.pop();         // 弹出栈顶（无返回值！）

// 正确的弹出+使用方式
int val = st.top(); st.pop();

st.size();
st.empty();
```

### 1.10.3 常见使用场景

```cpp
// 场景1：括号匹配
bool is_valid(const std::string& s) {
    std::stack<char> st;
    for (char c : s) {
        if (c == '(' || c == '[' || c == '{') st.push(c);
        else {
            if (st.empty()) return false;
            char top = st.top(); st.pop();
            if (c==')' && top!='(') return false;
            if (c==']' && top!='[') return false;
            if (c=='}' && top!='{') return false;
        }
    }
    return st.empty();
}

// 场景2：DFS（深度优先搜索）显式栈
std::stack<Node*> dfs_stack;
dfs_stack.push(root);
while (!dfs_stack.empty()) {
    Node* node = dfs_stack.top(); dfs_stack.pop();
    for (auto* child : node->children)
        dfs_stack.push(child);
}

// 场景3：计算器（逆波兰表达式）
std::stack<int> operands;
for (const auto& token : tokens) {
    if (is_number(token)) operands.push(stoi(token));
    else {
        int b = operands.top(); operands.pop();
        int a = operands.top(); operands.pop();
        if (token == "+") operands.push(a + b);
        if (token == "-") operands.push(a - b);
        // ...
    }
}

// 场景4：函数调用栈模拟（递归转迭代）
// 把递归参数显式压栈，消除递归
```

---

## 1.11 queue —— 先进先出

### 1.11.1 基本特性

```cpp
#include <queue>
std::queue<int> q;  // 默认底层是 deque
```

- 只暴露 `push`/`pop`/`front`/`back`，强制 FIFO 语义

### 1.11.2 核心操作

```cpp
std::queue<int> q;

q.push(1);
q.emplace(2);
q.front();         // 队头（下一个出队的）
q.back();          // 队尾（最近入队的）

int val = q.front(); q.pop();  // 出队

q.size();
q.empty();
```

### 1.11.3 常见使用场景

```cpp
// 场景1：BFS（最常见）
std::queue<std::pair<int,int>> bfs_queue;
bfs_queue.push({start_r, start_c});
while (!bfs_queue.empty()) {
    auto [r, c] = bfs_queue.front(); bfs_queue.pop();
    for (auto [dr, dc] : directions) {
        int nr = r+dr, nc = c+dc;
        if (valid(nr, nc) && !visited[nr][nc]) {
            visited[nr][nc] = true;
            bfs_queue.push({nr, nc});
        }
    }
}

// 场景2：生产者-消费者（配合 mutex/condvar）
std::queue<Task> task_queue;
std::mutex mtx;
std::condition_variable cv;

// 生产者
{
    std::lock_guard<std::mutex> lock(mtx);
    task_queue.push(new_task);
}
cv.notify_one();

// 消费者
{
    std::unique_lock<std::mutex> lock(mtx);
    cv.wait(lock, [&]{ return !task_queue.empty(); });
    Task t = task_queue.front(); task_queue.pop();
}

// 场景3：任务调度（FIFO 顺序执行）
std::queue<std::function<void()>> job_queue;
```

---

## 1.12 priority_queue —— 优先队列（堆）

### 1.12.1 基本特性

```cpp
#include <queue>
std::priority_queue<int> pq;               // 大根堆（默认）
std::priority_queue<int,
    std::vector<int>, std::greater<int>> min_pq;  // 小根堆
```

- 底层是堆（默认大根堆，堆顶最大）
- `top` O(1)，`push`/`pop` O(log n)
- **不支持随机访问，不支持遍历，不支持修改内部元素**

### 1.12.2 核心操作

```cpp
std::priority_queue<int> pq;

pq.push(3);
pq.push(1);
pq.push(4);
pq.push(1);
pq.push(5);

pq.top();      // 5（最大值）
pq.pop();      // 弹出5
pq.top();      // 4

pq.size();
pq.empty();

// 从 vector 建堆（O(n) 比逐个 push O(nlogn) 快）
std::vector<int> v = {3,1,4,1,5,9};
std::priority_queue<int> pq2(v.begin(), v.end());
```

### 1.12.3 自定义比较

```cpp
// 自定义：按结构体的某个字段排序
struct Task {
    int priority;
    std::string name;
};

// 大根堆：priority 大的先出
auto cmp = [](const Task& a, const Task& b) {
    return a.priority < b.priority;  // 注意：返回 true 表示 a 优先级低
};
std::priority_queue<Task, std::vector<Task>, decltype(cmp)> pq(cmp);

pq.push({3, "low"});
pq.push({10, "high"});
pq.push({5, "mid"});
pq.top().name;  // "high"
```

### 1.12.4 常见使用场景

```cpp
// 场景1：TopK 问题（最常见）
// 找数组中最大的 K 个数：用小根堆，维护大小为 K 的堆
std::priority_queue<int, std::vector<int>, std::greater<int>> min_heap;
for (int x : nums) {
    min_heap.push(x);
    if (min_heap.size() > k) min_heap.pop();  // 堆满时弹出最小值
}
// min_heap 中剩余的 k 个就是最大的 k 个

// 场景2：Dijkstra 最短路
using P = std::pair<int, int>;  // {距离, 节点}
std::priority_queue<P, std::vector<P>, std::greater<P>> pq;  // 小根堆
pq.push({0, start});
while (!pq.empty()) {
    auto [d, u] = pq.top(); pq.pop();
    if (d > dist[u]) continue;
    for (auto [v, w] : graph[u]) {
        if (dist[u] + w < dist[v]) {
            dist[v] = dist[u] + w;
            pq.push({dist[v], v});
        }
    }
}

// 场景3：合并 K 个有序链表
// 小根堆维护 K 个链表的当前头节点
std::priority_queue<ListNode*,
    std::vector<ListNode*>,
    [](ListNode* a, ListNode* b){ return a->val > b->val; }> pq;

// 场景4：事件驱动模拟（按时间排序的事件队列）
struct Event { int time; std::string name; };
auto cmp = [](const Event& a, const Event& b){ return a.time > b.time; };
std::priority_queue<Event, std::vector<Event>, decltype(cmp)> event_queue(cmp);
```

---

## 1.13 算法头文件速查

### 1.13.1 `<algorithm>` 常用算法

```cpp
// 不修改序列的算法
std::for_each          // 对每个元素执行操作
std::find              // 线性查找
std::find_if           // 条件查找
std::find_first_of     // 查找任意字符集中的第一个
std::count             // 统计个数
std::count_if          // 条件统计
std::all_of / any_of / none_of  // 全满足/任一满足/全不满足
std::mismatch          // 找第一个不同的位置
std::equal             // 判断两段是否相等
std::search            // 子序列查找

// 修改序列的算法
std::copy              // 拷贝
std::copy_if           // 条件拷贝
std::copy_n            // 拷贝前n个
std::move              // 移动拷贝（语义上的 move）
std::transform         // 变换（一元或二元）
std::replace           // 替换
std::replace_if        // 条件替换
std::fill              // 填充
std::fill_n            // 填充前n个
std::generate          // 生成（用函数）
std::generate_n        // 生成前n个
std::remove            // 逻辑删除（不改变大小）
std::remove_if         // 条件逻辑删除
std::unique            // 去重相邻重复

// 重排序列的算法
std::reverse           // 反转
std::rotate            // 旋转
std::shuffle           // 随机打乱
std::next_permutation  // 下一个排列
std::prev_permutation  // 上一个排列

// 分区
std::partition         // 按条件分区
std::stable_partition  // 稳定分区
std::partition_point   // 分区边界

// 排序
std::sort              // 不稳定排序 O(nlogn)
std::stable_sort       // 稳定排序 O(nlogn)
std::partial_sort      // 前K个有序
std::nth_element       // 第n个元素归位，两侧元素满足大小关系
std::is_sorted         // 判断是否有序
std::is_sorted_until   // 有序的最远位置

// 有序序列操作
std::binary_search     // 二分查找
std::lower_bound       // 第一个 >= x 的位置
std::upper_bound       // 第一个 > x 的位置
std::equal_range       // 等于x的范围
std::merge             // 合并两个有序序列
std::inplace_merge     // 原地合并
std::set_union/intersection/difference/symmetric_difference  // 集合操作
std::includes          // 子集判断

// 堆操作
std::make_heap         // 建堆
std::push_heap         // 入堆
std::pop_heap          // 出堆
std::sort_heap         // 堆排序
std::is_heap           // 判断是否是堆

// 最大最小
std::min / max                    // 两个值比较
std::min_element / max_element    // 序列中的最小/最大
std::minmax / minmax_element      // 同时获取最小最大
std::clamp                        // 限制在[min,max]范围（C++17）
```

### 1.13.2 `<numeric>` 数值算法

```cpp
std::accumulate        // 累积（求和、乘积等）
std::inner_product     // 内积（点积）
std::partial_sum       // 前缀和
std::adjacent_difference // 相邻差
std::iota              // 填充递增序列（1,2,3,...）
std::reduce            // C++17，parallel-friendly 的 accumulate
std::inclusive_scan    // C++17，前缀和（含当前元素）
std::exclusive_scan    // C++17，前缀和（不含当前元素）
std::transform_reduce  // C++17，map-reduce
```

---

## 1.14 容器与算法配合的最佳实践

### 1.14.1 输出迭代器（back_inserter / inserter）

```cpp
std::vector<int> src = {1, 2, 3, 4, 5};
std::vector<int> dst;

// back_inserter：自动调用 push_back（用于 vector/deque/list）
std::copy(src.begin(), src.end(), std::back_inserter(dst));
std::copy_if(src.begin(), src.end(), std::back_inserter(dst),
             [](int x){ return x > 2; });

// front_inserter：自动调用 push_front（用于 deque/list）
std::copy(src.begin(), src.end(), std::front_inserter(list_dst));

// inserter：指定位置插入（用于 set/map）
std::set<int> s;
std::copy(src.begin(), src.end(), std::inserter(s, s.begin()));
```

### 1.14.2 erase-remove 惯用法

```cpp
std::vector<int> v = {1, 2, 3, 4, 5, 2, 3};

// 删除所有等于2的元素
v.erase(std::remove(v.begin(), v.end(), 2), v.end());

// 删除所有满足条件的元素
v.erase(std::remove_if(v.begin(), v.end(),
        [](int x){ return x % 2 == 0; }), v.end());

// C++20 简化（推荐）
std::erase(v, 2);
std::erase_if(v, [](int x){ return x % 2 == 0; });
```

### 1.14.3 综合场景示例

```cpp
// 场景：统计成绩，找出高于平均分的学生，按成绩降序输出

struct Student { std::string name; int score; };
std::vector<Student> students = { {"Alice",90}, {"Bob",70}, {"Charlie",85} };

// 1. 计算平均分
int total = std::accumulate(students.begin(), students.end(), 0,
    [](int sum, const Student& s){ return sum + s.score; });
double avg = (double)total / students.size();

// 2. 筛选高于平均分的学生
std::vector<Student> above_avg;
std::copy_if(students.begin(), students.end(), std::back_inserter(above_avg),
    [avg](const Student& s){ return s.score > avg; });

// 3. 按成绩降序排序
std::sort(above_avg.begin(), above_avg.end(),
    [](const Student& a, const Student& b){ return a.score > b.score; });

// 4. 输出
std::for_each(above_avg.begin(), above_avg.end(),
    [](const Student& s){ std::cout << s.name << ": " << s.score << "\n"; });
```

---

## 1.15 总结：场景 → 容器选型

|场景|推荐容器|原因|
|---|---|---|
|大多数情况|`vector`|连续内存，cache 友好，接口最全|
|编译期固定大小|`array`|零开销，类型安全|
|头尾频繁插删|`deque`|头尾 O(1)|
|中间频繁插删且有稳定迭代器需求|`list`|O(1) 且迭代器不失效|
|去重+有序+范围查询|`set`|自动排序，lower_bound|
|键值映射+有序+范围查询|`map`|有序键值对|
|快速查找/插入（无序）|`unordered_set/map`|O(1) 平均|
|LIFO|`stack`|强制栈语义|
|FIFO|`queue`|强制队列语义|
|最大/最小优先|`priority_queue`|O(log n) 动态维护极值|
|LRU 缓存|`list` + `unordered_map`|O(1) 移动 + O(1) 查找|
|TopK|`priority_queue`|维护大小为 K 的堆|
|区间查询|`map`/`set` + `lower_bound`|利用有序性快速定位|