#!/bin/bash
g++ dropsim.cpp -o dropsim -std=c++17 -O3 -pthread -march=native
g++ dropsim.cpp -o dropsimbase -D"BASETC=1" -std=c++17 -O3 -pthread -march=native
g++ dropsolver.cpp -o dropsolver -std=c++17 -O3 -pthread -march=native
g++ dropsolver.cpp -o dropsolverbase -D"BASETC=1" -std=c++17 -O3 -pthread -march=native
