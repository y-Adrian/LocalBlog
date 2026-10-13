---
title: TCP:three and four way handshake
discription: NA
contentType: article
showArticleMeta: true
created: 2026-10-13
hideTitle: false
hideCreatedDate: false
hideReadingTime: false
---

## First we go back to this knwoledge

```bash
  # Three way handshake
  client    SYN, seq=x ----------->            server
	client    <----------- SYN, seq=y, ack=x+1   server
	client    ack=y+1    ----------->            server

	...

	# four way handshake
	client    FIN, seq=u ----------->            server
	<FIN_WAIT_1>
	client    <----------- ack=u+1               server
	<FIN_WAIT_2>                            <CLOSE_WAIT>
	...
	client    <----------- FIN, seq=v            server
	client    ack=v+1    ----------->            server
	<TIME_WAIT>
	...
	<CLOSED>
```

## Check this out on Mac

### Preparation

I am using a Mac, here is the detailed information:
```bash
# tcpdump --version
tcpdump version 4.99.1 -- Apple version 161
libpcap version 1.10.1
LibreSSL 3.3.6

# sw_vers
ProductName:		macOS
ProductVersion:		27.0.1
BuildVersion:		26A434

# uname -a
Darwin adrian 27.0.0 Darwin Kernel Version 27.0.0: Tue Aug 11 21:05:27 PDT 2026; root:xnu-13432.1.9~1/RELEASE_ARM64_T8103 arm64
```

Prepare for three terminal:

**Terminal A**: capture(needs sudo)
```bash
sudo tcpdump -i lo0 -nn -S 'tcp port 8000'
```

+ `-i lo0`: listen on the loopback interface
+ `-nn`: don't resolve hostnames or port names
+ `-S`: show absolute sequence numbers(the default is relative; absolute values are easier to follow when checking the theory)


**Ternimal B**:server
```bash
nc -l 8000
```

**Terminal C**: client
```bash
nv 127.0.0.1 8000
```
Once connected, type a line and press Enter(this produces a data packet), the press `Ctrl+C` to close the client and trigger the teardown.

### Check out the outputs

Before we read the outputs, we should figure out the meanings of tcpdump flags:
｜Flag｜Meaning｜
|-|-|
|[S]|SYN|
|[S.]|SYN+ACK|
|[.]|pureACK|
|P.|PSH+ACK(carries data)|
|[F.]|FIN+ACK|
|[R.]|RST+ACK|

Here are the outputs:
```bash
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on lo0, link-type NULL (BSD loopback), snapshot length 524288 bytes
19:21:24.893962 IP 127.0.0.1.49939 > 127.0.0.1.8000: Flags [S], seq 2758917539, win 65535, options [mss 16344,nop,wscale 6,nop,nop,TS val 716219584 ecr 0,sackOK,eol], length 0
19:21:24.894020 IP 127.0.0.1.8000 > 127.0.0.1.49939: Flags [S.], seq 3018352464, ack 2758917540, win 65535, options [nop,nop,TS val 1340052773 ecr 716219584,sackOK,nop,nop,mss 16344,nop,wscale 6], length 0
19:21:24.894047 IP 127.0.0.1.49939 > 127.0.0.1.8000: Flags [.], ack 3018352465, win 6380, options [nop,nop,TS val 716219584 ecr 1340052773], length 0
19:21:24.894098 IP 127.0.0.1.8000 > 127.0.0.1.49939: Flags [.], ack 2758917540, win 2075, options [nop,nop,TS val 1340052773 ecr 716219584], length 0
19:21:39.653936 IP 127.0.0.1.49939 > 127.0.0.1.8000: Flags [P.], seq 2758917540:2758917546, ack 3018352465, win 6380, options [nop,nop,TS val 716234344 ecr 1340052773], length 6
19:21:39.653977 IP 127.0.0.1.8000 > 127.0.0.1.49939: Flags [.], ack 2758917546, win 2075, options [nop,nop,TS val 1340067533 ecr 716234344], length 0
19:21:48.049987 IP 127.0.0.1.49939 > 127.0.0.1.8000: Flags [F.], seq 2758917546, ack 3018352465, win 6380, options [nop,nop,TS val 716242740 ecr 1340067533], length 0
19:21:48.050052 IP 127.0.0.1.8000 > 127.0.0.1.49939: Flags [.], ack 2758917547, win 2075, options [nop,nop,TS val 1340075929 ecr 716242740], length 0
19:21:48.050087 IP 127.0.0.1.8000 > 127.0.0.1.49939: Flags [F.], seq 3018352465, ack 2758917547, win 2075, options [nop,nop,TS val 1340075929 ecr 716242740], length 0
19:21:48.050120 IP 127.0.0.1.49939 > 127.0.0.1.8000: Flags [.], ack 3018352466, win 6380, options [nop,nop,TS val 716242740 ecr 1340075929], length 0
```
Now we can easily find the three way and four way handshake, we use `<` `>` to represent the directions here:
```bash
# Three way handshake
client(127.0.0.1.49939)                                               server(127.0.0.1.8000)
    |                                                                          |
    |>>>>>>>>>>>>>[S] SYN    seq:2758917539                            >>>>>>>>|                  -> SYN+seq

    |<<<<<<<<<<<<<[S.]SYN    ack:2758917540             seq:3018352464 <<<<<<<<|                  <- SYN+seq+ack
    
    |>>>>>>>>>>>>>[.]pureACK                            ack:3018352465 >>>>>>>>|                  -> SYN+ack
    
    |<<<<<<<<<<<<<[.]pureACK ack:2758917540                            <<<<<<<<|                  <- ack
    
    |>>>>>>>>>>>>>[[P.]      seq 2758917540:2758917546  ack 3018352465 >>>>>>>>|                  ->  packets(seq+ack) [2758917540:2758917546)
    
    |<<<<<<<<<<<<<[.]pureACK ack:2758917546                            <<<<<<<<|                  <- ack
    
    |>>>>>>>>>>>>>[[F.]FIN   seq:2758917546             ack:3018352465 >>>>>>>>|                  -> FIN+seq+ack
    
    |<<<<<<<<<<<<<[.]pureACK ack:2758917547                            <<<<<<<<|                  <- ack
    
    |<<<<<<<<<<<<<[F.]FIN    ack:2758917547             seq:3018352465 <<<<<<<<|                  <- FIN+seq+ack
    
    |>>>>>>>>>>>>>[[.]pureACK                           ack:3018352466 >>>>>>>>|                  -> ack
```
