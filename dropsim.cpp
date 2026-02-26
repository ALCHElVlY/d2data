/**
 * Cross-platform C++17 drop simulator.
 *
 * Compiles with:
 *   - Linux: g++ dropsim.cpp -o dropsim -std=c++17 -pthread
 *   - Windows: Visual Studio 2017+ (C++17 support required)
 */

 // Disable MSVC security warnings for fopen, strcspn, etc.
#ifdef _MSC_VER
#define _CRT_SECURE_NO_WARNINGS
#endif

#if defined(_WIN32) || defined(_WIN64)
#define DIRECTORY_SEPARATOR '\\'
#define DIRECTORY_SEPARATOR_STRING "\\"
#else
#define DIRECTORY_SEPARATOR '/'
#define DIRECTORY_SEPARATOR_STRING "/"
#endif

#ifndef BASETC
#define BASETC 0
#endif

#include <unordered_map>
#include <iostream>
#include <cstdio>
#include <string>
#include <cstring>
#include <vector>
#include <thread>
#include <atomic>
#include <random>
#include <algorithm>
#include <iomanip>
#include <fstream>
#include <filesystem>
#include <cmath>

struct Entry {
    std::string name;
    int prob = 0;
};

struct TC {
    std::string name;
    int group = 0;
    int level = 0;
    int picks = 0;
    int unique = 0;
    int set = 0;
    int rare = 0;
    int magic = 0;
    int nodrop = 0;

    Entry items[10];

    int total = 0;
};

struct AtomicTC {
    std::vector<Entry> items;

    int total = 0;
};

struct Drop {
    std::string name;
    int magic;
    int rare;
    int set;
    int unique;

    bool operator==(const Drop& other) const {
        return name == other.name && magic == other.magic && rare == other.rare && set == other.set && unique == other.unique;
    }
};

namespace std {
    template <>
    struct hash<Drop> {
        std::size_t operator()(const Drop& d) const {
            return ((std::hash<std::string>()(d.name)
                    ^ (std::hash<int>()(d.magic) << 1)) >> 1)
                    ^ (std::hash<int>()(d.rare) << 1)
                    ^ (std::hash<int>()(d.set) << 1)
                    ^ (std::hash<int>()(d.unique) << 1);
        }
    };
}

std::unordered_map<std::string, AtomicTC> atomic;
std::unordered_map<std::string, TC> treasureClasses;
int playermod = 1;
std::random_device rd;
std::mt19937 gen(rd());

// Helper function to split string by tab delimiter, keeping empty strings between tabs
std::vector<std::string> splitByChar(const std::string& str, char delimiter) {
    std::vector<std::string> tokens;
    size_t start = 0;
    size_t end = str.find(delimiter);

    while (end != std::string::npos) {
        tokens.push_back(str.substr(start, end - start));
        start = end + 1;
        end = str.find(delimiter, start);
    }
    // Add the last token (after the final tab or remaining text)
    tokens.push_back(str.substr(start));

    return tokens;
}

void pickAtomic(std::string tcname, int magic, int rare, int set, int unique, std::vector<Drop>& drops) {
    if (atomic.find(tcname) == atomic.end()) {
        drops.push_back({tcname, magic, rare, set, unique});
        return;
    }

    AtomicTC& atc = atomic[tcname];

    if (atc.total == 0) {
        return;
    }

    std::uniform_int_distribution<> dis(0, atc.total - 1);
    int picknum = dis(gen);

    for (auto item : atc.items) {
        if (picknum < item.prob) {
            drops.push_back({item.name, magic, rare, set, unique});
            return;
        }

        picknum -= item.prob;
    }
}

long calcNodrop(long e, long nd, long d) {
    double _e = (double)e, _nd = (double)nd, _d = (double)d;
    if (nd < 1) {
        return 0;
    }

    if (d < 1) {
        return nd;
    }

    return (long)(_d / (pow((_nd + _d) / nd, _e) - 1));
}

void pick(std::string tcname, int magic, int rare, int set, int unique, std::vector<Drop>& drops) {
    if (drops.size() >= 6) {
        return;
    }

    if (treasureClasses.find(tcname) == treasureClasses.end()) {
        pickAtomic(tcname, magic, rare, set, unique, drops);
        return;
    }
    
    TC& tc = treasureClasses[tcname];

    magic = std::max(magic, tc.magic);
    rare = std::max(rare, tc.rare);
    set = std::max(set, tc.set);
    unique = std::max(unique, tc.unique);

    if (tc.picks == 0) {
        return;
    }

    if (tc.total == 0) {
        return;
    }

    int picks = tc.picks > 0 ? tc.picks : -tc.picks;
    long nodrop = calcNodrop(playermod, tc.nodrop, tc.total);

    std::uniform_int_distribution<long> dis(0, nodrop + tc.total - 1);

    if (tc.picks > 0) {
        for (int i = 0; i < picks; i++) {
            if (drops.size() >= 6) {
                return;
            }

            long picknum = dis(gen) - nodrop;

            if (picknum < 0) {
                continue;
            }

            for (auto item : tc.items) {
                if (item.prob) {
                    if (picknum < item.prob) {
                        pick(item.name, magic, rare, set, unique, drops);
                        break;
                    }

                    picknum -= item.prob;
                }
            }
        }
    }
    else {
        for (auto item : tc.items) {
            for (int i = 0; i < item.prob; i++) {
                if (picks <= 0 || drops.size() >= 6) {
                    return;
                }

                pick(item.name, magic, rare, set, unique, drops);
                picks--;
            }
        }
    }
}

std::string realpath(std::string path) {
    return std::filesystem::canonical(std::filesystem::absolute(path)).string();
}

// Main takes first parameter as treasure class name
int main(int argc, char* argv[]) {
    if (argc < 2) {
        std::cout << "Usage: " << argv[0] << " <treasure_class_name> <player_mod> <drop_cycles>\n";
        return 1;
    }

    std::vector<std::string> pathParts = splitByChar(argv[0], DIRECTORY_SEPARATOR);
    pathParts.pop_back();
    std::string path = "";

    for (const auto& part : pathParts) {
        path += part + DIRECTORY_SEPARATOR_STRING;
    }

    path = realpath(path) + DIRECTORY_SEPARATOR_STRING;
    std::string txtDir = realpath(path + "txt") + DIRECTORY_SEPARATOR_STRING;
    std::string simulationsPath = realpath(path + "simulations") + DIRECTORY_SEPARATOR_STRING;

    std::string tcname = argv[1];
    int dropcycles = 100000;

    if (argc >= 3) {
        playermod = atoi(argv[2]);
    }

    playermod = std::max(1, playermod);
    playermod = std::min(8, playermod);

    if (argc >= 4) {
        dropcycles = atoi(argv[3]);
    }

    dropcycles = std::max(1, dropcycles);
    dropcycles = std::min(1000000, dropcycles);

    std::cout << tcname << " [" << playermod << "]" << std::endl;

    // Open the treasure class file at: txt/treasureclassex.txt
    FILE* tex = fopen((txtDir + (BASETC ? "base/treasureclassex.txt" : "treasureclassex.txt")).c_str(), "r");
    if (!tex) {
        std::cout << "Error: Could not open treasure class file\n";
        return 1;
    }

    // Treasure class file is tab delimited and has a header row, so skip the first line
    char line[1024];
    fgets(line, sizeof(line), tex); // Skip header

    while (fgets(line, sizeof(line), tex)) {
        // remove newline if it exists
        line[strcspn(line, "\r\n")] = 0;

        // Split by tab delimiter, preserving empty strings
        std::string lineStr(line);
        std::vector<std::string> tokens = splitByChar(lineStr, '\t');

        if (tokens.empty()) continue;

        TC tc;
        tc.name = tokens[0];

        if (tokens.size() > 1) {
            tc.group = atoi(tokens[1].c_str());
        }

        if (tokens.size() > 2) {
            tc.level = atoi(tokens[2].c_str());
        }

        if (tokens.size() > 3) {
            tc.picks = atoi(tokens[3].c_str());
        }

        if (tokens.size() > 4) {
            tc.unique = atoi(tokens[4].c_str());
        }

        if (tokens.size() > 5) {
            tc.set = atoi(tokens[5].c_str());
        }

        if (tokens.size() > 6) {
            tc.rare = atoi(tokens[6].c_str());
        }

        if (tokens.size() > 7) {
            tc.magic = atoi(tokens[7].c_str());
        }

        if (tokens.size() > 8) {
            tc.nodrop = atoi(tokens[8].c_str());
        }

        // Process items
        for (int i = 0; i < 10; i++) {
            int itemIdx = 9 + (i * 2);
            int probIdx = itemIdx + 1;

            if (itemIdx >= 0 && probIdx < tokens.size() && tokens[itemIdx][0] != '\0' && tokens[probIdx][0] != '\0') {
                tc.items[i].name = tokens[itemIdx];
                tc.items[i].prob = atoi(tokens[probIdx].c_str());
                tc.total += tc.items[i].prob;
            }

        }

        treasureClasses[tc.name] = tc;
    }

    fclose(tex);

    // Open the file at: atomic.txt
    FILE* atomicbase = fopen((path + (BASETC ? "atomicbase.txt" : "atomic.txt")).c_str(), "r");

    if (!atomicbase) {
        std::cerr << "Error: Could not open atomic file\n";
        return 1;
    }

    while (fgets(line, sizeof(line), atomicbase)) {
        // remove newline if it exists
        line[strcspn(line, "\r\n")] = 0;

        // Split by tab delimiter, preserving empty strings
        std::string lineStr(line);
        std::vector<std::string> tokens = splitByChar(lineStr, '\t');

        if (tokens.empty()) continue;

        AtomicTC atc;
        std::string tcBaseName = tokens[0];
        atomic[tcBaseName] = atc;

        for (long i = 1; i < tokens.size() - 1; i += 2) {
            std::string itemName = tokens[i];
            int itemProb = atoi(tokens[i + 1].c_str());

            atomic[tcBaseName].items.push_back({ itemName, itemProb });
            atomic[tcBaseName].total += itemProb;
        }
    }

    fclose(atomicbase);

    if (treasureClasses.find(tcname) == treasureClasses.end()) {
        std::cerr << "Error: Treasure class not found: " << tcname << "\n";
        return 1;
    }

    // Get CPU count.
    int thread_count = std::thread::hardware_concurrency() * 2 / 3; // Use 2/3 of available threads to avoid overloading the system

    if (thread_count < 1) {
        thread_count = 1; // Fallback to 1 if hardware_concurrency cannot determine.
    }
    else {
        thread_count -= 2; // Leave 2 cores free to avoid system overload
        if (thread_count < 1) {
            thread_count = 1; // Ensure at least one thread is used
        }
    }

    long mindropcount = thread_count;

    if (argc >= 5) {
        mindropcount = atoi(argv[4]);
    }

    mindropcount = std::max(1L, mindropcount);

    std::vector<std::thread> threads;

    for (int i = 0; i < thread_count; i++) {
        threads.emplace_back([i, thread_count, &tcname, dropcycles, mindropcount, &simulationsPath]() {
            long totalruns = 0;
            long totalpicks = 0;
            std::unordered_map<Drop, long> totaldrops;
                        
            for (size_t seq = 0; true; seq++) {
                long runs = 0;
                long picks = 0;
                std::unordered_map<Drop, long> drops;

                for (int j = 0; j < dropcycles; j++) {
                    std::vector<Drop> rundrops;
                    pick(tcname, 0, 0, 0, 0, rundrops);

                    for (const auto& drop : rundrops) {
                        drops[drop]++;
                        totaldrops[drop]++;
                        totalpicks++;
                        picks++;
                    }

                    totalruns++;
                    runs++;
                }

                size_t fullseq = seq * thread_count + i;

                // Write results to file as json with name: results-{timestamp}_{i}.json
                // Each thread has a separate file based on `i` to avoid race conditions or write conflicts.
                std::string filename = (BASETC ? simulationsPath + "base/" : simulationsPath) + tcname + " [" + std::to_string(playermod) + "][" + std::to_string(fullseq) + "].json";
                std::ofstream out(filename);

                out << "{\n";
                out << "  \"tc\": \"" << tcname << "\",\n";
                out << "  \"playermod\": " << playermod << ",\n";
                out << "  \"seq\": " << fullseq << ",\n";
                out << "  \"runs\": " << runs << ",\n";
                out << "  \"picks\": " << picks << ",\n";
                out << "  \"avgpicks\": " << std::fixed << std::setprecision(6) << (double)totalpicks / totalruns << ",\n";
                out << "  \"drops\": [\n";
                long count = 0;
                for (const auto& drop : drops) {
                    std::string escapedDrop = drop.first.name;
                    // Escape backslashes and double quotes in the drop name
                    size_t pos = 0;
                    while ((pos = escapedDrop.find('\\', pos)) != std::string::npos) {
                        escapedDrop.insert(pos, "\\");
                        pos += 2; // Move past the escaped backslash
                    }
                    pos = 0;
                    while ((pos = escapedDrop.find('\"', pos)) != std::string::npos) {
                        escapedDrop.insert(pos, "\\");
                        pos += 2; // Move past the escaped quote
                    }
                    out << "    [\"" + escapedDrop + "\", " << drop.second << ", " << drop.first.magic << ", " << drop.first.rare << ", " << drop.first.set << ", " << drop.first.unique << "]";
                    if (++count < drops.size()) {
                        out << ",";
                    }
                    out << "\n";
                }
                out << "  ]\n";
                out << "}\n";

                if (seq * dropcycles >= 400000) {
                    // Check if all items have at least mindropcount drops, and if so, break the loop to finish this thread's execution.
                    bool allAboveMin = true;
                    for (const auto& drop : totaldrops) {
                        if (drop.second < mindropcount) {
                            allAboveMin = false;
                            printf("Thread %d: Item \'%s\' has %ld drops left...\n", i, drop.first.name.c_str(), mindropcount - drop.second);
                            break;
                        }
                    }
    
                    if (allAboveMin) {
                        break;
                    }
                }
            }
        });
    }

    for (int i = 0; i < thread_count; i++) {
        threads[i].join();
    }

    return 0;
}
