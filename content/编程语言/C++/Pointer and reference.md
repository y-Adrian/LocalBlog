*A **pointer** is a variable that stores the memory address of another object, while a **reference** is a alias(an alternative name) for an exist object*.

| Feature           | Pointer(T*)                                       | Reference(T&)                                                             |
| ----------------- | ------------------------------------------------- | ------------------------------------------------------------------------- |
| Reassignment      | Can be reassigned to point to different objects   | Bound permanently to the object upon initialization; cannot be reassigned |
| Nullability       | Can be nullptr                                    | Must refer to a valid object(cannot be null)                              |
| Initialization    | Can be declared without initialization            | Must be initialized when declared                                         |
| Syntax            | Requires explicit dereferencing or arrow operator | Use normal variable syntax directly                                       |
| Indirection Level | Supports multiple levels                          | Only one level of reference binding                                       |
| Memory address    | Has its own distinct memory address               | Shares the address of the referenced object                               |
