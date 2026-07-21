#!/usr/bin/env python3
"""
玩具 Raft：单进程内模拟 3 个节点（选举 + 日志复制 + 多数派提交）。

对应博文：content/分布式系统/共识算法/玩具 Raft 三节点实验.md
仅用于理解协议，不是生产实现（无持久化、无真实网络、无成员变更）。
"""

from __future__ import annotations

import argparse
import random
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class Role(Enum):
    FOLLOWER = "Follower"
    CANDIDATE = "Candidate"
    LEADER = "Leader"


@dataclass
class LogEntry:
    term: int
    command: str  # 简化：字符串命令，如 "set x=1"


@dataclass
class Node:
    node_id: int
    peers: list[int]
    role: Role = Role.FOLLOWER
    current_term: int = 0
    voted_for: Optional[int] = None
    log: list[LogEntry] = field(default_factory=list)
    commit_index: int = -1
    last_applied: int = -1
    # Leader only
    next_index: dict[int, int] = field(default_factory=dict)
    match_index: dict[int, int] = field(default_factory=dict)
    # 状态机：极简 KV
    kv: dict[str, str] = field(default_factory=dict)
    # 计时（毫秒时间戳语义由 Cluster 驱动）
    election_deadline_ms: float = 0.0
    # 宕机模拟
    alive: bool = True

    def last_log_index(self) -> int:
        return len(self.log) - 1

    def last_log_term(self) -> int:
        return self.log[-1].term if self.log else 0

    def apply_committed(self) -> list[str]:
        applied: list[str] = []
        while self.last_applied < self.commit_index:
            self.last_applied += 1
            cmd = self.log[self.last_applied].command
            if cmd.startswith("set "):
                # set key=value
                body = cmd[4:]
                if "=" in body:
                    k, v = body.split("=", 1)
                    self.kv[k] = v
            applied.append(cmd)
        return applied


class Cluster:
    """单线程事件循环：推进选举超时、心跳、客户端写。"""

    def __init__(self, n: int = 3, seed: int = 42):
        if n < 3 or n % 2 == 0:
            raise ValueError("玩具 lab 建议奇数节点且 >= 3")
        self.rng = random.Random(seed)
        self.now_ms = 0.0
        self.nodes: dict[int, Node] = {}
        ids = list(range(n))
        for i in ids:
            peers = [j for j in ids if j != i]
            node = Node(node_id=i, peers=peers)
            self._reset_election_deadline(node)
            self.nodes[i] = node
        self.trace: list[str] = []

    def log(self, msg: str) -> None:
        line = f"t={self.now_ms:7.1f}ms  {msg}"
        self.trace.append(line)
        print(line)

    def _reset_election_deadline(self, node: Node) -> None:
        # 150–300ms 风格的随机超时（这里用加速时间轴）
        timeout = self.rng.uniform(150.0, 300.0)
        node.election_deadline_ms = self.now_ms + timeout

    def majority(self) -> int:
        return len(self.nodes) // 2 + 1

    def leader(self) -> Optional[Node]:
        for n in self.nodes.values():
            if n.alive and n.role == Role.LEADER:
                return n
        return None

    # ---------- RPC（进程内直接调用） ----------

    def request_vote(
        self, to_id: int, term: int, candidate_id: int, last_log_index: int, last_log_term: int
    ) -> tuple[int, bool]:
        node = self.nodes[to_id]
        if not node.alive:
            return term, False
        if term < node.current_term:
            return node.current_term, False
        if term > node.current_term:
            self._become_follower(node, term)
        # 日志至少一样新
        up_to_date = (last_log_term > node.last_log_term()) or (
            last_log_term == node.last_log_term() and last_log_index >= node.last_log_index()
        )
        grant = False
        if (node.voted_for is None or node.voted_for == candidate_id) and up_to_date:
            node.voted_for = candidate_id
            grant = True
            self._reset_election_deadline(node)
        return node.current_term, grant

    def append_entries(
        self,
        to_id: int,
        term: int,
        leader_id: int,
        prev_log_index: int,
        prev_log_term: int,
        entries: list[LogEntry],
        leader_commit: int,
    ) -> tuple[int, bool]:
        node = self.nodes[to_id]
        if not node.alive:
            return term, False
        if term < node.current_term:
            return node.current_term, False
        if term >= node.current_term:
            self._become_follower(node, term)
            self._reset_election_deadline(node)

        # 日志一致性检查
        if prev_log_index >= 0:
            if (
                prev_log_index > node.last_log_index()
                or node.log[prev_log_index].term != prev_log_term
            ):
                return node.current_term, False
        elif prev_log_index == -1 and node.log and not entries:
            # 心跳且 prev=-1：空日志节点 OK
            pass

        # 冲突截断 + 追加
        insert_at = prev_log_index + 1
        if entries:
            # 若已有冲突条目则截断
            if insert_at <= node.last_log_index():
                if node.log[insert_at].term != entries[0].term:
                    node.log = node.log[:insert_at]
            for i, e in enumerate(entries):
                idx = insert_at + i
                if idx <= node.last_log_index():
                    if node.log[idx].term != e.term:
                        node.log = node.log[:idx]
                        node.log.append(e)
                    # 相同则跳过
                else:
                    node.log.append(e)

        if leader_commit > node.commit_index:
            node.commit_index = min(leader_commit, node.last_log_index())
            applied = node.apply_committed()
            if applied:
                self.log(f"N{to_id} apply {applied} kv={dict(node.kv)}")

        return node.current_term, True

    # ---------- 角色转换 ----------

    def _become_follower(self, node: Node, term: int) -> None:
        node.current_term = term
        node.role = Role.FOLLOWER
        node.voted_for = None

    def _start_election(self, node: Node) -> None:
        if not node.alive:
            return
        node.role = Role.CANDIDATE
        node.current_term += 1
        node.voted_for = node.node_id
        self._reset_election_deadline(node)
        votes = 1
        self.log(
            f"N{node.node_id} 发起选举 term={node.current_term} "
            f"lastLog=({node.last_log_index()},{node.last_log_term()})"
        )
        for peer in node.peers:
            term, granted = self.request_vote(
                peer,
                node.current_term,
                node.node_id,
                node.last_log_index(),
                node.last_log_term(),
            )
            if term > node.current_term:
                self._become_follower(node, term)
                return
            if granted:
                votes += 1
        if votes >= self.majority() and node.role == Role.CANDIDATE:
            self._become_leader(node)

    def _become_leader(self, node: Node) -> None:
        node.role = Role.LEADER
        for peer in node.peers:
            node.next_index[peer] = node.last_log_index() + 1
            node.match_index[peer] = -1
        self.log(f"N{node.node_id} 成为 Leader term={node.current_term}")
        self._broadcast_append(node)  # 立即心跳压制选举

    def _broadcast_append(self, leader: Node) -> None:
        if not leader.alive or leader.role != Role.LEADER:
            return
        for peer in leader.peers:
            next_idx = leader.next_index.get(peer, 0)
            prev = next_idx - 1
            prev_term = leader.log[prev].term if prev >= 0 else 0
            entries = leader.log[next_idx:]
            term, ok = self.append_entries(
                peer,
                leader.current_term,
                leader.node_id,
                prev,
                prev_term,
                entries,
                leader.commit_index,
            )
            if term > leader.current_term:
                self._become_follower(leader, term)
                return
            if ok:
                leader.next_index[peer] = leader.last_log_index() + 1
                leader.match_index[peer] = leader.last_log_index()
            else:
                # 回退 nextIndex 再试（玩具：每次 -1）
                leader.next_index[peer] = max(0, next_idx - 1)

        # 多数派匹配 → 提交
        for idx in range(leader.commit_index + 1, leader.last_log_index() + 1):
            if leader.log[idx].term != leader.current_term:
                continue  # 只提交当前任期条目（Raft 安全规则简化）
            count = 1  # leader 自己
            for peer in leader.peers:
                if leader.match_index.get(peer, -1) >= idx:
                    count += 1
            if count >= self.majority():
                leader.commit_index = idx
        applied = leader.apply_committed()
        if applied:
            self.log(f"N{leader.node_id}(L) commit/apply {applied} kv={dict(leader.kv)}")

    # ---------- 客户端与故障 ----------

    def client_set(self, key: str, value: str) -> bool:
        leader = self.leader()
        if leader is None:
            self.log(f"客户端 set {key}={value} 失败：无 Leader")
            return False
        cmd = f"set {key}={value}"
        leader.log.append(LogEntry(term=leader.current_term, command=cmd))
        self.log(f"客户端 → N{leader.node_id} 追加 {cmd}")
        self._broadcast_append(leader)
        return True

    def kill(self, node_id: int) -> None:
        n = self.nodes[node_id]
        n.alive = False
        n.role = Role.FOLLOWER
        self.log(f"N{node_id} 宕机")

    def revive(self, node_id: int) -> None:
        n = self.nodes[node_id]
        n.alive = True
        n.role = Role.FOLLOWER
        n.voted_for = None
        self._reset_election_deadline(n)
        self.log(f"N{node_id} 恢复（Follower）")

    # ---------- 时间推进 ----------

    def tick(self, dt_ms: float = 10.0) -> None:
        self.now_ms += dt_ms
        # Leader 心跳周期 ~50ms
        for n in self.nodes.values():
            if not n.alive:
                continue
            if n.role == Role.LEADER and int(self.now_ms) % 50 < dt_ms:
                self._broadcast_append(n)
            elif n.role != Role.LEADER and self.now_ms >= n.election_deadline_ms:
                self._start_election(n)

    def run_until_leader(self, max_ms: float = 2000.0) -> Optional[Node]:
        while self.now_ms < max_ms:
            if self.leader():
                return self.leader()
            self.tick(10.0)
        return None

    def dump(self) -> None:
        for n in self.nodes.values():
            status = "UP" if n.alive else "DOWN"
            self.log(
                f"状态 N{n.node_id}[{status}] {n.role.value} term={n.current_term} "
                f"log_len={len(n.log)} commit={n.commit_index} kv={dict(n.kv)}"
            )


def demo_basic(seed: int = 42) -> None:
    print("=== Demo A：选举 + 写入多数派提交 ===\n")
    c = Cluster(n=3, seed=seed)
    leader = c.run_until_leader()
    assert leader is not None
    c.client_set("x", "1")
    c.client_set("y", "2")
    for _ in range(20):
        c.tick(10.0)
    c.dump()
    # 存活节点 KV 应一致
    ups = [n for n in c.nodes.values() if n.alive]
    assert all(n.kv.get("x") == "1" and n.kv.get("y") == "2" for n in ups)
    print("\n断言通过：存活节点 KV 一致\n")


def demo_leader_fail(seed: int = 7) -> None:
    print("=== Demo B：Leader 宕机 → 重选 → 继续写 ===\n")
    c = Cluster(n=3, seed=seed)
    leader = c.run_until_leader()
    assert leader is not None
    lid = leader.node_id
    c.client_set("a", "10")
    for _ in range(15):
        c.tick(10.0)
    c.kill(lid)
    # 等待新 Leader
    new_leader = None
    for _ in range(200):
        c.tick(10.0)
        new_leader = c.leader()
        if new_leader is not None:
            break
    assert new_leader is not None and new_leader.node_id != lid
    c.client_set("a", "20")
    for _ in range(30):
        c.tick(10.0)
    c.dump()
    ups = [n for n in c.nodes.values() if n.alive]
    assert all(n.kv.get("a") == "20" for n in ups)
    print("\n断言通过：新 Leader 下写入仍可提交\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="玩具 Raft 三节点实验")
    parser.add_argument(
        "demo",
        nargs="?",
        default="all",
        choices=["all", "basic", "failover"],
        help="运行哪个演示",
    )
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    if args.demo in ("all", "basic"):
        demo_basic(args.seed)
    if args.demo in ("all", "failover"):
        demo_leader_fail(args.seed + 1)


if __name__ == "__main__":
    main()
