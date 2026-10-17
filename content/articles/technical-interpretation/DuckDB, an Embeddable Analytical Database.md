---
title: DuckDB, an Embeddable Analytical Database
date: 2026/10/17
showArticleMeta: true
tags:
  - DATABASE
contentType: article
---

## Why is there DuckDB?

There is a need for unobtrusive in-process data management. However, there is no such a system yet geared towards analytical workloads. 
There are requirements for embedded analytical databases:
+ High efficiency for OLAP workloads, but without completely sacrificing OLTP performance.
+ Efficient transfer of tables to and from the database is essential.
+ High degree of stability.
+ Practical "embeddability" and portability, the database needs to run in whatever environment the host does.

Then came the DuckDB. DuckDB is a new purpose-built embeddable relational database management system, and is also open-source.

## Design and implementation
DuckDB's design decisions are informed by its intended use case: embedded analytics.
The main components: parser, logical planner, optimizer, physical planner, execution engine.
![Component Overview|577](Pasted%20image%2020261017154942.png)

Being an embedded database, DuckDB does not have a client protocol interface or a server process, but instead is accessed using a C/C++ API.

### SQL parser

The SQL parser is derived from Postgres' SQL parser that has been stripped down as much as possible. The parser takes a SQL query string as input and returns a parse tree of C structures. This parse tree is then immediately transformed into parse tree of C++ classes to limit the reach of Postgres' data structures.

### Logic planner

The logical planner consists of two parts:
+ the binder
+ the plan generator
The binder resolves all expressions referring to schema objects such as tables or views with their column names and types. The logical plan generator then transforms the parse tree into a tree of basic logical query operators such as scan, filter, project, etc. After the planning phase, we have a fully type-resolved logical query plan.

DuckDB keeps statistics on the stored data, and these statistics are used in the optimizer itself, and are also used for integer overflow prevention by upgrading types when required.

### Optimizer

DuckDB's optimizer performs join order optimization using dynamic programming with a greedy fallback for complex join graphs.
In addition, there are a set of rewrite rules that simplify the expression tree, by performing common subexpression elimination and constant folding. The result of this process is the optimized logical plan for the query.

### Physical planner

The physical planner transforms the logical plan into the physical plan, selecting suitable implementations where applicable.

### Execution engine

DuckDB uses a vectorized interpreted execution engine. This approach was chosen over Just-in-Time compilation of SQL queries for portability reasons. 

DuckDB uses vectors of a fixed maximum amount of values(1024 per default).:
+ Fixed-length types such as integers are stored as native arrays. 
+ Variable-length values such as strings are represented as a native array of pointers into a separate string heap. 
+ NULL values are represented using a separate bit vector, which is only present if NULL values appear in the vector. This allows fast intersection of NULL vectors for binary vector operations and avoids redundant computation.
To avoid excessive shifting of a data within the vectors when e.g. the data is filtered, the vectors may have a selection vector, which is a list of offsets into the vector stating which indices of the vector are relevant.

The execution engine executes the query in a so-called "Vector Volcano" model. Query execution commences by pulling the first "chunk" of a data from the root node of the physical plan. A chunk is a horizontal subset of a result set, query intermediate or base table. This node will recursively pull chunks from child nodes, eventually arriving at a scan operator which produces chunks by reading form the persistent tables. This continues until the chunk arriving at the root is empty, at which point the query is completed.

## References

1. [DuckDB: an Embeddable Analytical Database](https://duckdb.org/pdf/SIGMOD2019-demo-duckdb.pdf)