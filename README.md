# ♟️ Web-Based Chess Engine & Developer Workbench

A complete browser-based Chess Workbench built from scratch with Vanilla JavaScript. This project serves as a testbed for developing and benchmarking custom chess AI engines. It features a modern Glassmorphism UI, drag-and-drop gameplay, move history navigation, and a headless tournament runner for empirical ELO calculation.


## ✨ Key Features

* **Zero-Setup Execution**: Runs entirely client-side directly from the file system. Clever use of Blob URLs bypasses standard Web Worker `file://` CORS restrictions.
* **Custom AI Engines**: Implementations ranging from purely random play to an advanced Alpha-Beta searcher.
* **Engine Tournament Runner**: Run headless, automated, multi-game round-robin tournaments between different engines to empirically calculate their relative ELO ratings.
* **Developer Tooling**: 
    * Built-in **Perft** (Performance Test) node-counting validator.
    * Custom FEN & PGN import/export.
    * Force AI move & Pause/Resume search execution.
* **Stockfish Integration**: Leverages Web Workers to run `stockfish.js` (ASM.js) asynchronously as a benchmark opponent.
* **Modern UI/UX**: Custom-built HTML5 drag-and-drop chessboard, responsive glassmorphic design, evaluation bar, and interactive move history timeline.

---

## 🧠 The Engines & Algorithmic Progression

This project implements several engine tiers to demonstrate the progression of chess programming techniques:

### 1. `RandomEngine`
Plays completely random legal moves. Used as a baseline for tournament testing.

### 2. `NaiveEngine` (Depth 1)
A greedy evaluator that looks exactly one ply ahead. 
* **Material Evaluation**: Standard piece values (P=100, N=320, B=330, R=500, Q=900).
* **Positional Heuristics**: Evaluates mobility (number of legal moves), check bonuses, and a late-game mating drive (pushing the enemy king to the edge).

### 3. `AdvancedEngine` (The Core Implementation)
A time-managed search engine implementing modern chess programming algorithms:
* **Alpha-Beta Pruning (Negamax)**: Drastically reduces the search space by eliminating provably irrelevant branches.
* **Iterative Deepening**: Searches progressively deeper until a hard time limit is reached, ensuring a "best-so-far" move is always available.
* **Quiescence Search**: Mitigates the "horizon effect" by continuing the search out to a stable state (only looking at captures) at the end of the main search depth.
* **Move Ordering (MVV-LVA & Killer Moves)**: Optimizes Alpha-Beta cutoffs by searching the most promising moves first (Most Valuable Victim - Least Valuable Attacker, plus tracking moves that caused cutoffs in sibling nodes).
* **Transposition Table**: Caches previously evaluated positions (using FEN) to prevent redundant calculations across different move orders.
* **Piece-Square Tables (PST)**: Encourages positional play (e.g., centralizing knights, preventing early king movement) without deep search.

---

## 🏗️ Technical Architecture

The application is built using a strict Object-Oriented design, separating game state, UI rendering, and AI logic:

* **`GameController.js`**: The central orchestrator. Maintains the truth of the game state, handles the main game loop, and delegates turns between players.
* **`Player.js` (Abstract)**: Base class for all actors. Requires a `think(game)` method that returns a `Promise<string>` (the move). This abstraction allows Human UI interactions, main-thread JS engines, and Web Worker engines to be used interchangeably.
* **`ChessBoardUI.js`**: Handles all DOM manipulation, CSS Grid rendering, and native HTML5 drag-and-drop events decoupled from game logic.
* **`Tournament.js`**: A specialized headless runner that strips away UI updates to run thousands of engine evaluations per second, utilizing mathematical models to distribute estimated ELOs.

---

## 🚀 Getting Started

Because this project is built with Vanilla JS and loads external scripts safely via Blob URLs, there is **zero build step and no local web server required**.

1. **Clone the repository**
   ```bash
   git clone [https://github.com/PatrikBobko/ChessEngine.git](https://github.com/PatrikBobko/ChessEngine.git)
   ```
2. **Run the Application**
   Simply locate the folder on your computer and double-click `index.html` to open it in your preferred web browser.

---


## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

*Stockfish is open source (GPL) and is included via CDN for benchmarking purposes.*
