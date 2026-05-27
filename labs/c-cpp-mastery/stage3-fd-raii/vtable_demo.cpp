struct Base {
    virtual ~Base() = default;
    virtual int foo() const { return 1; }
};

struct Derived : Base {
    int foo() const override { return 2; }
};

int main()
{
    Derived d;
    return d.foo();
}
