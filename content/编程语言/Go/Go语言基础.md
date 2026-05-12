# 1 Go 语言实战教程

> 专为有 C/C++ 基础的程序员设计

---

## 1.1 为什么学 Go？与 C/C++ 的对比

作为 C/C++ 开发者，你会发现 Go 既熟悉又清爽：

|特性|C/C++|Go|
|---|---|---|
|编译速度|慢（大项目尤甚）|**极快**|
|内存管理|手动（malloc/free/RAII）|**GC 自动管理**|
|并发|pthread / std::thread|**Goroutine（轻量级）**|
|错误处理|返回码 / 异常|**多返回值 + error**|
|泛型|模板（复杂）|泛型（Go 1.18+，简单）|
|头文件|需要 .h 文件|**无头文件**|
|构建系统|Makefile / CMake|**内置 go build**|
|指针|完整指针运算|指针（无运算，更安全）|

**一句话定位**：Go 是"带 GC 的 C"，语法极简，工程化极强，天生为并发而生。

---

## 1.2 环境搭建

### 1.2.1 安装

```bash
# macOS
brew install go

# Linux
wget https://go.dev/dl/go1.22.linux-amd64.tar.gz
tar -C /usr/local -xzf go1.22.linux-amd64.tar.gz
export PATH=$PATH:/usr/local/go/bin

# 验证
go version  # go version go1.22.x linux/amd64
```

### 1.2.2 创建第一个项目

```bash
mkdir hello-go && cd hello-go
go mod init hello-go   # 初始化模块（类似 cmake 的 CMakeLists.txt）
```

创建 `main.go`：

```go
package main

import "fmt"

func main() {
    fmt.Println("Hello, Go!")
}
```

```bash
go run main.go    # 直接运行
go build -o hello # 编译成二进制
./hello
```

### 1.2.3 推荐 IDE

- **VS Code** + Go 插件（官方推荐）
- **GoLand**（JetBrains，收费但强大）

---

## 1.3 基础语法快速上手

### 1.3.1 变量声明

```go
// C 风格对比
// int x = 10;         →  var x int = 10
// auto x = 10;        →  x := 10  (短变量声明，最常用)

var a int = 10       // 显式类型
var b = 20           // 类型推断
c := 30              // 短声明（只能在函数内）

// 多变量
x, y := 1, 2
x, y = y, x  // 交换！Go 原生支持
```

### 1.3.2 基本数据类型

```go
// 整数：int8, int16, int32, int64, int（平台相关，64位系统为64位）
// 无符号：uint8(byte), uint16, uint32, uint64
// 浮点：float32, float64
// 字符串：string（不可变，UTF-8）
// 布尔：bool

var s string = "你好，Go"
fmt.Println(len(s))        // 字节数：12（UTF-8 中文3字节）
fmt.Println(len([]rune(s))) // 字符数：5
```

### 1.3.3 数组与切片（重点！）

> C++ 开发者注意：Go 中最常用的是**切片（Slice）**，而非固定大小数组。

```go
// 数组（固定大小，类似 C 数组）
arr := [3]int{1, 2, 3}
arr2 := [...]int{1, 2, 3}  // 自动推断长度

// 切片（动态数组，类似 std::vector）
s := []int{1, 2, 3, 4, 5}
s = append(s, 6)           // 追加元素
sub := s[1:3]              // 切片 [2, 3]，左闭右开

// make 创建（类似 vector 预分配）
s2 := make([]int, 5)       // 长度5，容量5，初始化为0
s3 := make([]int, 5, 10)   // 长度5，容量10

// 遍历
for i, v := range s {
    fmt.Printf("index=%d, value=%d\n", i, v)
}
```

### 1.3.4 Map（哈希表）

```go
// 类似 std::unordered_map
m := map[string]int{
    "apple": 5,
    "banana": 3,
}

m["cherry"] = 8           // 插入/更新
delete(m, "apple")        // 删除

// 判断 key 是否存在（C++ 开发者必须注意这个模式）
val, ok := m["banana"]
if ok {
    fmt.Println("found:", val)
}

// 遍历（无序！）
for k, v := range m {
    fmt.Printf("%s: %d\n", k, v)
}
```

### 1.3.5 流程控制

```go
// if（条件无需括号）
if x > 0 {
    fmt.Println("positive")
} else if x < 0 {
    fmt.Println("negative")
} else {
    fmt.Println("zero")
}

// if 带初始化语句（很实用）
if err := doSomething(); err != nil {
    fmt.Println("error:", err)
}

// for（Go 只有 for，没有 while）
for i := 0; i < 10; i++ { }          // 类似 C for
for i < 10 { i++ }                    // 类似 while
for { break }                         // 死循环

// switch（不需要 break，自动 break）
switch os {
case "linux":
    fmt.Println("Linux")
case "windows", "win32":
    fmt.Println("Windows")
default:
    fmt.Println("unknown")
}
```

---

## 1.4 函数与多返回值

Go 最让 C/C++ 开发者惊喜的特性之一：**函数可以返回多个值**。

```go
// 基本函数
func add(a, b int) int {
    return a + b
}

// 多返回值（告别输出参数指针！）
func divide(a, b float64) (float64, error) {
    if b == 0 {
        return 0, fmt.Errorf("division by zero")
    }
    return a / b, nil
}

// 使用
result, err := divide(10, 2)
if err != nil {
    log.Fatal(err)
}
fmt.Println(result) // 5.0

// 命名返回值
func minMax(arr []int) (min, max int) {
    min, max = arr[0], arr[0]
    for _, v := range arr[1:] {
        if v < min { min = v }
        if v > max { max = v }
    }
    return  // 裸 return，返回命名变量
}

// 可变参数（类似 C 的 ...）
func sum(nums ...int) int {
    total := 0
    for _, n := range nums {
        total += n
    }
    return total
}
sum(1, 2, 3)
nums := []int{1, 2, 3}
sum(nums...)  // 展开切片
```

### 1.4.1 defer（类似 RAII，但更简单）

```go
// defer 在函数返回前执行，LIFO 顺序
func readFile(path string) error {
    f, err := os.Open(path)
    if err != nil {
        return err
    }
    defer f.Close()  // 无论如何都会关闭，告别忘记 close！

    // ... 处理文件
    return nil
}

// 多个 defer：LIFO 顺序执行
func demo() {
    defer fmt.Println("first defer")   // 最后执行
    defer fmt.Println("second defer")  // 先执行
    fmt.Println("main body")
}
// 输出：main body → second defer → first defer
```

---

## 1.5 指针——熟悉又陌生

Go 有指针，但**没有指针运算**（更安全），也**没有 `->` 运算符**（统一用 `.`）。

```go
x := 10
p := &x          // 取地址，p 是 *int
fmt.Println(*p)  // 解引用：10
*p = 20
fmt.Println(x)   // 20

// new 分配（类似 C++ 的 new，但不需要手动 delete）
p2 := new(int)   // 分配 int，返回 *int，初始化为 0
*p2 = 42

// 结构体指针：统一用 . 访问（不需要 ->）
type Point struct { X, Y int }
pt := &Point{1, 2}
fmt.Println(pt.X)  // 自动解引用，不用 pt->X
```

### 1.5.1 值传递 vs 指针传递

```go
// 值传递（修改不影响原值）
func doubleVal(n int) { n *= 2 }

// 指针传递（修改影响原值，类似 C 的 int*）
func doublePtr(n *int) { *n *= 2 }

x := 5
doubleVal(x)   // x 仍为 5
doublePtr(&x)  // x 变为 10
```

---

## 1.6 结构体与方法

Go 没有类，用**结构体 + 方法**实现面向对象。

```go
// 定义结构体
type Rectangle struct {
    Width  float64
    Height float64
}

// 值接收者方法（不修改原值）
func (r Rectangle) Area() float64 {
    return r.Width * r.Height
}

// 指针接收者方法（修改原值，推荐大结构体用这个）
func (r *Rectangle) Scale(factor float64) {
    r.Width *= factor
    r.Height *= factor
}

// 构造函数（约定用 New 前缀）
func NewRectangle(w, h float64) *Rectangle {
    return &Rectangle{Width: w, Height: h}
}

// 使用
rect := NewRectangle(3, 4)
fmt.Println(rect.Area())  // 12
rect.Scale(2)
fmt.Println(rect.Area())  // 48

// 嵌入（类似继承，但更像组合）
type ColorRect struct {
    Rectangle       // 嵌入，继承所有方法
    Color string
}

cr := ColorRect{Rectangle: Rectangle{3, 4}, Color: "red"}
fmt.Println(cr.Area())  // 直接调用嵌入的方法
```

---

## 1.7 接口（Interface）

Go 的接口是**隐式实现**的——只要实现了接口的所有方法，就自动满足接口，**不需要显式 implements**。

```go
// 定义接口
type Shape interface {
    Area() float64
    Perimeter() float64
}

// Rectangle 隐式实现 Shape（无需声明）
func (r Rectangle) Area() float64 {
    return r.Width * r.Height
}
func (r Rectangle) Perimeter() float64 {
    return 2 * (r.Width + r.Height)
}

// Circle 也实现 Shape
type Circle struct{ Radius float64 }
func (c Circle) Area() float64      { return math.Pi * c.Radius * c.Radius }
func (c Circle) Perimeter() float64 { return 2 * math.Pi * c.Radius }

// 多态使用
func printShapeInfo(s Shape) {
    fmt.Printf("Area: %.2f, Perimeter: %.2f\n", s.Area(), s.Perimeter())
}

printShapeInfo(Rectangle{3, 4})
printShapeInfo(Circle{5})

// 类型断言
var s Shape = Circle{5}
if c, ok := s.(Circle); ok {
    fmt.Println("Is circle, radius:", c.Radius)
}

// 类型 switch
func describe(s Shape) {
    switch v := s.(type) {
    case Rectangle:
        fmt.Printf("Rectangle: %v x %v\n", v.Width, v.Height)
    case Circle:
        fmt.Printf("Circle: radius %v\n", v.Radius)
    }
}
```

---

## 1.8 错误处理

Go 没有异常机制，用**多返回值 + error 接口**处理错误。这是最大的思维转变之一。

```go
// error 是内置接口
// type error interface { Error() string }

// 自定义错误
type ValidationError struct {
    Field   string
    Message string
}
func (e *ValidationError) Error() string {
    return fmt.Sprintf("validation error: %s - %s", e.Field, e.Message)
}

// 返回错误
func validateAge(age int) error {
    if age < 0 {
        return &ValidationError{Field: "age", Message: "must be non-negative"}
    }
    if age > 150 {
        return fmt.Errorf("age %d is unrealistic", age)
    }
    return nil
}

// errors.Is / errors.As（Go 1.13+，错误包装）
import "errors"

var ErrNotFound = errors.New("not found")

func findUser(id int) error {
    return fmt.Errorf("findUser %d: %w", id, ErrNotFound)  // %w 包装错误
}

err := findUser(42)
if errors.Is(err, ErrNotFound) {  // 解包检查
    fmt.Println("user not found")
}

// panic 和 recover（类似 C++ 异常，但只用于真正的不可恢复错误）
func safeDiv(a, b int) (result int, err error) {
    defer func() {
        if r := recover(); r != nil {
            err = fmt.Errorf("recovered: %v", r)
        }
    }()
    result = a / b  // b==0 会 panic
    return
}
```

---

## 1.9 Go 的核心：Goroutine 与 Channel

这是 Go 最强大的特性，也是与 C/C++ 差别最大的地方。

### 1.9.1 Goroutine

```go
// goroutine：轻量级协程，比线程轻1000倍
// 一个程序可以轻松跑 100万个 goroutine

func sayHello(id int) {
    fmt.Printf("Hello from goroutine %d\n", id)
}

// 启动 goroutine（加 go 关键字）
go sayHello(1)  // 异步执行

// sync.WaitGroup：等待 goroutine 完成（类似 pthread_join）
var wg sync.WaitGroup
for i := 0; i < 5; i++ {
    wg.Add(1)
    go func(id int) {
        defer wg.Done()
        sayHello(id)
    }(i)
}
wg.Wait()  // 等待所有 goroutine 结束
```

### 1.9.2 Channel（通道）

```go
// channel：goroutine 之间通信的管道（"不要通过共享内存通信，而是通过通信共享内存"）

// 无缓冲 channel
ch := make(chan int)
go func() { ch <- 42 }()  // 发送（阻塞直到有人接收）
val := <-ch                // 接收
fmt.Println(val)           // 42

// 有缓冲 channel
buffered := make(chan string, 3)
buffered <- "a"
buffered <- "b"
buffered <- "c"
// buffered <- "d"  // 会阻塞，缓冲满了

// 关闭 channel + range 遍历
ch2 := make(chan int, 5)
go func() {
    for i := 0; i < 5; i++ {
        ch2 <- i
    }
    close(ch2)  // 关闭 channel
}()
for v := range ch2 {  // 自动检测关闭
    fmt.Println(v)
}

// select：多路复用（类似 epoll/select，但用于 channel）
func fanIn(ch1, ch2 <-chan string) <-chan string {
    merged := make(chan string)
    go func() {
        defer close(merged)
        for {
            select {
            case v, ok := <-ch1:
                if !ok { ch1 = nil; continue }
                merged <- v
            case v, ok := <-ch2:
                if !ok { ch2 = nil; continue }
                merged <- v
            }
            if ch1 == nil && ch2 == nil { return }
        }
    }()
    return merged
}
```

### 1.9.3 sync.Mutex（互斥锁）

```go
// 当需要保护共享状态时使用 Mutex
type SafeCounter struct {
    mu    sync.Mutex
    count int
}

func (c *SafeCounter) Inc() {
    c.mu.Lock()
    defer c.mu.Unlock()
    c.count++
}

func (c *SafeCounter) Value() int {
    c.mu.Lock()
    defer c.mu.Unlock()
    return c.count
}

// 使用
counter := &SafeCounter{}
var wg sync.WaitGroup
for i := 0; i < 1000; i++ {
    wg.Add(1)
    go func() {
        defer wg.Done()
        counter.Inc()
    }()
}
wg.Wait()
fmt.Println(counter.Value())  // 1000
```

---

## 1.10 包管理与模块系统

```bash
# 初始化模块
go mod init github.com/yourname/myproject

# 添加依赖
go get github.com/gin-gonic/gin@latest

# 整理依赖
go mod tidy

# 查看依赖树
go mod graph
```

### 1.10.1 项目结构（推荐）

```
myproject/
├── go.mod
├── go.sum
├── cmd/
│   └── server/
│       └── main.go      # 程序入口
├── internal/            # 内部包，不对外暴露
│   ├── handler/
│   └── service/
├── pkg/                 # 可对外使用的包
└── README.md
```

---

## 1.11 实战项目一：命令行文件统计工具

统计指定目录下各类文件的数量和大小。

```go
// cmd/filestat/main.go
package main

import (
    "fmt"
    "os"
    "path/filepath"
    "sort"
    "strings"
)

type FileStats struct {
    Count int64
    Size  int64
}

func main() {
    root := "."
    if len(os.Args) > 1 {
        root = os.Args[1]
    }

    stats := make(map[string]*FileStats)

    err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
        if err != nil {
            return err
        }
        if info.IsDir() {
            return nil
        }

        ext := strings.ToLower(filepath.Ext(path))
        if ext == "" {
            ext = "(no ext)"
        }

        if _, ok := stats[ext]; !ok {
            stats[ext] = &FileStats{}
        }
        stats[ext].Count++
        stats[ext].Size += info.Size()
        return nil
    })

    if err != nil {
        fmt.Fprintf(os.Stderr, "Error: %v\n", err)
        os.Exit(1)
    }

    // 按文件数量排序
    type entry struct {
        ext   string
        stats *FileStats
    }
    entries := make([]entry, 0, len(stats))
    for ext, s := range stats {
        entries = append(entries, entry{ext, s})
    }
    sort.Slice(entries, func(i, j int) bool {
        return entries[i].stats.Count > entries[j].stats.Count
    })

    fmt.Printf("%-15s %8s %12s\n", "Extension", "Count", "Size")
    fmt.Println(strings.Repeat("-", 40))
    for _, e := range entries {
        fmt.Printf("%-15s %8d %12s\n", e.ext, e.stats.Count, formatSize(e.stats.Size))
    }
}

func formatSize(bytes int64) string {
    const unit = 1024
    if bytes < unit {
        return fmt.Sprintf("%d B", bytes)
    }
    div, exp := int64(unit), 0
    for n := bytes / unit; n >= unit; n /= unit {
        div *= unit
        exp++
    }
    return fmt.Sprintf("%.1f %cB", float64(bytes)/float64(div), "KMGTPE"[exp])
}
```

```bash
go run main.go /path/to/your/project
# Extension       Count         Size
# ----------------------------------------
# .go               142        234.5 KB
# .md                12         45.2 KB
# .json               8         12.1 KB
```

---

## 1.12 实战项目二：HTTP REST API 服务器

使用标准库实现一个简单的 Todo API（不依赖第三方框架）。

```go
package main

import (
    "encoding/json"
    "fmt"
    "log"
    "net/http"
    "strconv"
    "strings"
    "sync"
)

type Todo struct {
    ID   int    `json:"id"`
    Text string `json:"text"`
    Done bool   `json:"done"`
}

type Store struct {
    mu     sync.RWMutex
    todos  map[int]*Todo
    nextID int
}

func NewStore() *Store {
    return &Store{todos: make(map[int]*Todo), nextID: 1}
}

func (s *Store) Create(text string) *Todo {
    s.mu.Lock()
    defer s.mu.Unlock()
    todo := &Todo{ID: s.nextID, Text: text}
    s.todos[s.nextID] = todo
    s.nextID++
    return todo
}

func (s *Store) List() []*Todo {
    s.mu.RLock()
    defer s.mu.RUnlock()
    result := make([]*Todo, 0, len(s.todos))
    for _, t := range s.todos {
        result = append(result, t)
    }
    return result
}

func (s *Store) Get(id int) (*Todo, bool) {
    s.mu.RLock()
    defer s.mu.RUnlock()
    t, ok := s.todos[id]
    return t, ok
}

func (s *Store) Update(id int, done bool) (*Todo, bool) {
    s.mu.Lock()
    defer s.mu.Unlock()
    t, ok := s.todos[id]
    if !ok {
        return nil, false
    }
    t.Done = done
    return t, true
}

func (s *Store) Delete(id int) bool {
    s.mu.Lock()
    defer s.mu.Unlock()
    if _, ok := s.todos[id]; !ok {
        return false
    }
    delete(s.todos, id)
    return true
}

// HTTP 处理器
func writeJSON(w http.ResponseWriter, status int, v any) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    json.NewEncoder(w).Encode(v)
}

func main() {
    store := NewStore()
    mux := http.NewServeMux()

    // GET /todos - 获取所有
    // POST /todos - 创建
    mux.HandleFunc("/todos", func(w http.ResponseWriter, r *http.Request) {
        switch r.Method {
        case http.MethodGet:
            writeJSON(w, http.StatusOK, store.List())
        case http.MethodPost:
            var body struct{ Text string `json:"text"` }
            if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Text == "" {
                writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
                return
            }
            writeJSON(w, http.StatusCreated, store.Create(body.Text))
        default:
            w.WriteHeader(http.StatusMethodNotAllowed)
        }
    })

    // GET /todos/{id} - 获取单个
    // PUT /todos/{id} - 更新
    // DELETE /todos/{id} - 删除
    mux.HandleFunc("/todos/", func(w http.ResponseWriter, r *http.Request) {
        idStr := strings.TrimPrefix(r.URL.Path, "/todos/")
        id, err := strconv.Atoi(idStr)
        if err != nil {
            writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid id"})
            return
        }

        switch r.Method {
        case http.MethodGet:
            todo, ok := store.Get(id)
            if !ok {
                writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
                return
            }
            writeJSON(w, http.StatusOK, todo)

        case http.MethodPut:
            var body struct{ Done bool `json:"done"` }
            json.NewDecoder(r.Body).Decode(&body)
            todo, ok := store.Update(id, body.Done)
            if !ok {
                writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
                return
            }
            writeJSON(w, http.StatusOK, todo)

        case http.MethodDelete:
            if !store.Delete(id) {
                writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
                return
            }
            w.WriteHeader(http.StatusNoContent)
        }
    })

    addr := ":8080"
    fmt.Printf("Server running at http://localhost%s\n", addr)
    log.Fatal(http.ListenAndServe(addr, mux))
}
```

```bash
# 测试
curl -X POST http://localhost:8080/todos -d '{"text":"学习Go"}' -H "Content-Type: application/json"
curl http://localhost:8080/todos
curl -X PUT http://localhost:8080/todos/1 -d '{"done":true}'
curl -X DELETE http://localhost:8080/todos/1
```

---

## 1.13 实战项目三：并发爬虫

展示 goroutine + channel 的真实威力：并发抓取多个 URL。

```go
package main

import (
    "fmt"
    "net/http"
    "sync"
    "time"
)

type Result struct {
    URL        string
    StatusCode int
    Duration   time.Duration
    Err        error
}

// 并发爬取，最多 maxConcurrency 个并发
func crawl(urls []string, maxConcurrency int) []Result {
    results := make([]Result, 0, len(urls))
    resultCh := make(chan Result, len(urls))

    // 用 buffered channel 作信号量控制并发数
    sem := make(chan struct{}, maxConcurrency)

    var wg sync.WaitGroup
    client := &http.Client{Timeout: 10 * time.Second}

    for _, url := range urls {
        wg.Add(1)
        go func(u string) {
            defer wg.Done()

            sem <- struct{}{}        // 占用一个槽
            defer func() { <-sem }() // 释放槽

            start := time.Now()
            resp, err := client.Get(u)
            duration := time.Since(start)

            r := Result{URL: u, Duration: duration, Err: err}
            if err == nil {
                r.StatusCode = resp.StatusCode
                resp.Body.Close()
            }
            resultCh <- r
        }(url)
    }

    // 等待所有完成后关闭 channel
    go func() {
        wg.Wait()
        close(resultCh)
    }()

    for r := range resultCh {
        results = append(results, r)
    }
    return results
}

func main() {
    urls := []string{
        "https://www.google.com",
        "https://www.github.com",
        "https://www.golang.org",
        "https://www.stackoverflow.com",
        "https://www.cloudflare.com",
    }

    fmt.Printf("Crawling %d URLs with concurrency=3...\n\n", len(urls))
    start := time.Now()
    results := crawl(urls, 3)
    total := time.Since(start)

    for _, r := range results {
        if r.Err != nil {
            fmt.Printf("❌ %-35s ERROR: %v\n", r.URL, r.Err)
        } else {
            fmt.Printf("✅ %-35s %d  (%v)\n", r.URL, r.StatusCode, r.Duration.Round(time.Millisecond))
        }
    }
    fmt.Printf("\nTotal: %v (serial would take ~%v)\n", total.Round(time.Millisecond),
        sumDurations(results).Round(time.Millisecond))
}

func sumDurations(results []Result) time.Duration {
    var total time.Duration
    for _, r := range results {
        total += r.Duration
    }
    return total
}
```

---

## 1.14 进阶：性能与常见陷阱

### 1.14.1 常见陷阱

**陷阱1：goroutine 闭包捕获循环变量**

```go
// ❌ 错误：所有 goroutine 捕获同一个 i
for i := 0; i < 5; i++ {
    go func() { fmt.Println(i) }()  // 可能全部打印 5
}

// ✅ 正确：传参或创建新变量
for i := 0; i < 5; i++ {
    go func(i int) { fmt.Println(i) }(i)
}
```

**陷阱2：切片底层数组共享**

```go
a := []int{1, 2, 3, 4, 5}
b := a[1:3]  // b 和 a 共享底层数组！
b[0] = 99
fmt.Println(a) // [1 99 3 4 5]，a 被修改了！

// 如果需要独立副本：
c := make([]int, len(b))
copy(c, b)
```

**陷阱3：接口与 nil 的微妙关系**

```go
// 接口有两部分：类型 + 值。两者都为 nil 才是 nil 接口
var err error = (*os.PathError)(nil)
fmt.Println(err == nil)  // false！有类型，接口不为 nil

// 正确做法：直接返回 nil
func mayFail(fail bool) error {
    if fail {
        return &os.PathError{}
    }
    return nil  // 不要返回 (*os.PathError)(nil)
}
```

### 1.14.2 性能工具

```bash
# 基准测试
go test -bench=. -benchmem ./...

# CPU 性能分析
go test -cpuprofile cpu.prof -bench=.
go tool pprof cpu.prof

# 竞态检测（并发 Bug 克星）
go run -race main.go
go test -race ./...

# 内存逃逸分析（了解栈/堆分配）
go build -gcflags="-m" main.go
```

### 1.14.3 常用标准库速查

|需求|包|
|---|---|
|HTTP 客户端/服务器|`net/http`|
|JSON 序列化|`encoding/json`|
|文件操作|`os`, `io`, `bufio`|
|字符串处理|`strings`, `strconv`|
|正则表达式|`regexp`|
|时间|`time`|
|并发原语|`sync`, `sync/atomic`|
|上下文控制|`context`|
|日志|`log`, `log/slog`（1.21+）|
|测试|`testing`|
|路径操作|`path/filepath`|

---

## 1.15 下一步学习路径

```
基础掌握（本教程）
    ↓
context 包（超时/取消控制）
    ↓
泛型（Go 1.18+）
    ↓
选择方向：
  ├── Web 后端：Gin / Echo 框架
  ├── 微服务：gRPC + Protobuf
  ├── 云原生：Kubernetes 相关开发
  └── 系统工具：CLI 工具开发
```

**推荐资源：**

- [Go 官方 Tour](https://go.dev/tour)（互动教程）
- [Effective Go](https://go.dev/doc/effective_go)（官方最佳实践）
- [Go by Example](https://gobyexample.com/)（代码示例库）
- 书籍：《The Go Programming Language》（圣经级别）

---

> 🎯 **学习建议**：直接动手写代码是最快的方式。建议把实战项目全部自己敲一遍，然后尝试在项目二的基础上加上 `context` 超时控制，这会让你对 Go 的并发模型有更深的理解。