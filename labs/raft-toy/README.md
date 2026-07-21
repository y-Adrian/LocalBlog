# raft-toy — 玩具 Raft（3 节点，单进程）

对应博文：`content/分布式系统/共识算法/玩具 Raft 三节点实验.md`

## 运行

```bash
cd labs/raft-toy
python3 raft.py          # 跑 basic + failover
python3 raft.py basic
python3 raft.py failover --seed 7
```

依赖：仅 Python 3.10+ 标准库。

## 范围

- ✅ 选举、`AppendEntries` 心跳、日志追加、多数派提交、Leader 宕机重选
- ❌ 持久化、真实网络、快照、成员变更、线性一致读优化
