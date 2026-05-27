CXX = c++
CC = cc
CXXFLAGS = -Wall -Wextra -std=c++17 -g
CFLAGS = -Wall -Wextra -std=c11 -g

all: app

app: main.o dpdk_bridge.o
	$(CXX) $(CXXFLAGS) -o $@ main.o dpdk_bridge.o

main.o: main.cpp dpdk_bridge.h
	$(CXX) $(CXXFLAGS) -c main.cpp

dpdk_bridge.o: dpdk_bridge.c dpdk_bridge.h
	$(CC) $(CFLAGS) -c dpdk_bridge.c

clean:
	rm -f app main.o dpdk_bridge.o

.PHONY: all clean
