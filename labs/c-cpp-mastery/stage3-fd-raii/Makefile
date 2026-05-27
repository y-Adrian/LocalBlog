CXX = c++
CXXFLAGS = -Wall -Wextra -std=c++17 -g

all: demo vtable_demo

demo: demo.cpp fd_guard.hpp
	$(CXX) $(CXXFLAGS) demo.cpp -o $@

vtable_demo: vtable_demo.cpp
	$(CXX) $(CXXFLAGS) vtable_demo.cpp -o $@

clean:
	rm -f demo vtable_demo

.PHONY: all clean
