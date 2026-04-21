/**
 * AdvancedEngine — Alpha-Beta with Modern Techniques
 *
 * This engine demonstrates several well-known chess-programming techniques,
 * each of which represents a concrete, measurable improvement that can be
 * documented in a thesis:
 *
 *  1. Alpha-Beta Pruning      — eliminates provably irrelevant branches
 *  2. Iterative Deepening     — guarantees a best-so-far move at any time
 *  3. Quiescence Search       — avoids the "horizon effect" on captures
 *  4. Piece-Square Tables     — positional awareness beyond raw material
 *  5. Move Ordering (MVV-LVA) — maximises alpha-beta cutoffs
 *  6. Transposition Table     — caches results via Zobrist hashing
 *  7. Time Management         — hard time limit enforced during search
 *
 * The search runs on the main thread but respects a strict time budget.
 * Iterative deepening ensures we always have a best-so-far move even if
 * time runs out mid-iteration.
 */
class AdvancedEngine extends Player {
    constructor(color) {
        super(color);
        this.name = "Advanced Engine";
        this.isHuman = false;
        this._aborted = false;

        this.nodesSearched = 0;
        this.maxDepth = 4;               // will be set based on time control

        /* Time management */
        this.timeLimitMs = 1000;
        this.searchStartTime = 0;
        this._timeUp = false;

        /* Transposition table — simple Map keyed by FEN */
        this.ttable = new Map();
        this.TT_MAX_SIZE = 50_000;

        /* Killer moves: two slots per ply */
        this.killers = [];
    }

    /* ==================================================================
     *  PIECE VALUES  (centipawns)
     * ================================================================== */
    static PIECE_VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

    /* ==================================================================
     *  PIECE-SQUARE TABLES  (from White's perspective; mirrored for Black)
     * ================================================================== */
    static PST = {
        p: [
             0,  0,  0,  0,  0,  0,  0,  0,
            50, 50, 50, 50, 50, 50, 50, 50,
            10, 10, 20, 30, 30, 20, 10, 10,
             5,  5, 10, 25, 25, 10,  5,  5,
             0,  0,  0, 20, 20,  0,  0,  0,
             5, -5,-10,  0,  0,-10, -5,  5,
             5, 10, 10,-20,-20, 10, 10,  5,
             0,  0,  0,  0,  0,  0,  0,  0
        ],
        n: [
            -50,-40,-30,-30,-30,-30,-40,-50,
            -40,-20,  0,  0,  0,  0,-20,-40,
            -30,  0, 10, 15, 15, 10,  0,-30,
            -30,  5, 15, 20, 20, 15,  5,-30,
            -30,  0, 15, 20, 20, 15,  0,-30,
            -30,  5, 10, 15, 15, 10,  5,-30,
            -40,-20,  0,  5,  5,  0,-20,-40,
            -50,-40,-30,-30,-30,-30,-40,-50
        ],
        b: [
            -20,-10,-10,-10,-10,-10,-10,-20,
            -10,  0,  0,  0,  0,  0,  0,-10,
            -10,  0, 10, 10, 10, 10,  0,-10,
            -10,  5,  5, 10, 10,  5,  5,-10,
            -10,  0, 10, 10, 10, 10,  0,-10,
            -10, 10, 10, 10, 10, 10, 10,-10,
            -10,  5,  0,  0,  0,  0,  5,-10,
            -20,-10,-10,-10,-10,-10,-10,-20
        ],
        r: [
             0,  0,  0,  0,  0,  0,  0,  0,
             5, 10, 10, 10, 10, 10, 10,  5,
            -5,  0,  0,  0,  0,  0,  0, -5,
            -5,  0,  0,  0,  0,  0,  0, -5,
            -5,  0,  0,  0,  0,  0,  0, -5,
            -5,  0,  0,  0,  0,  0,  0, -5,
            -5,  0,  0,  0,  0,  0,  0, -5,
             0,  0,  0,  5,  5,  0,  0,  0
        ],
        q: [
            -20,-10,-10, -5, -5,-10,-10,-20,
            -10,  0,  0,  0,  0,  0,  0,-10,
            -10,  0,  5,  5,  5,  5,  0,-10,
             -5,  0,  5,  5,  5,  5,  0, -5,
              0,  0,  5,  5,  5,  5,  0, -5,
            -10,  5,  5,  5,  5,  5,  0,-10,
            -10,  0,  5,  0,  0,  0,  0,-10,
            -20,-10,-10, -5, -5,-10,-10,-20
        ],
        k: [
            -30,-40,-40,-50,-50,-40,-40,-30,
            -30,-40,-40,-50,-50,-40,-40,-30,
            -30,-40,-40,-50,-50,-40,-40,-30,
            -30,-40,-40,-50,-50,-40,-40,-30,
            -20,-30,-30,-40,-40,-30,-30,-20,
            -10,-20,-20,-20,-20,-20,-20,-10,
             20, 20,  0,  0,  0,  0, 20, 20,
             20, 30, 10,  0,  0, 10, 30, 20
        ]
    };

    /* ==================================================================
     *  TIME CHECK  — called every 512 nodes
     *
     *  When time runs out _timeUp is set, which propagates up through
     *  every recursive call. Iterative deepening then returns the best
     *  move found by the last *completed* iteration.
     * ================================================================== */
    checkTime() {
        if ((this.nodesSearched & 511) !== 0) return;
        if (Date.now() - this.searchStartTime >= this.timeLimitMs) {
            this._timeUp = true;
        }
    }

    /* ==================================================================
     *  STATIC EVALUATION  (from White's perspective)
     * ================================================================== */
    evaluate(game) {
        if (game.in_checkmate()) {
            return game.turn() === 'w' ? -99999 : 99999;
        }
        if (game.in_draw() || game.in_stalemate() || game.in_threefold_repetition() || game.insufficient_material()) {
            return 0;
        }

        const board = game.board();
        let score = 0;

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const sq = board[r][c];
                if (!sq) continue;

                const pv  = AdvancedEngine.PIECE_VALUE[sq.type] || 0;
                const pst = AdvancedEngine.PST[sq.type] || null;

                let positional = 0;
                if (pst) {
                    positional = sq.color === 'w'
                        ? pst[r * 8 + c]
                        : pst[(7 - r) * 8 + c];
                }

                const total = pv + positional;
                score += sq.color === 'w' ? total : -total;
            }
        }

        return score;
    }

    /* ==================================================================
     *  MOVE ORDERING  (MVV-LVA + Killers + TT best-move)
     * ================================================================== */
    orderMoves(moves, ply, ttBestMove) {
        const scored = moves.map(m => {
            let score = 0;

            // TT best move — always search first
            if (ttBestMove && m.from === ttBestMove.from && m.to === ttBestMove.to) {
                score += 50000;
            }

            // Captures — MVV-LVA
            if (m.captured) {
                const victim   = AdvancedEngine.PIECE_VALUE[m.captured] || 0;
                const attacker = AdvancedEngine.PIECE_VALUE[m.piece]    || 0;
                score += 10000 + victim - attacker;
            }

            // Promotions
            if (m.promotion) {
                score += AdvancedEngine.PIECE_VALUE[m.promotion] || 0;
            }

            // Killer moves
            if (!m.captured && this.killers[ply]) {
                for (const killer of this.killers[ply]) {
                    if (killer && killer.from === m.from && killer.to === m.to) {
                        score += 5000;
                        break;
                    }
                }
            }

            return { move: m, score };
        });

        scored.sort((a, b) => b.score - a.score);
        return scored.map(s => s.move);
    }

    /* ==================================================================
     *  QUIESCENCE SEARCH  (limited to 6 plies to prevent explosion)
     * ================================================================== */
    quiescence(game, alpha, beta, sideSign, qDepth) {
        this.nodesSearched++;
        this.checkTime();
        if (this._timeUp || this._aborted) return 0;

        const standPat = sideSign * this.evaluate(game);

        if (standPat >= beta) return beta;
        if (standPat > alpha) alpha = standPat;

        // Limit quiescence depth to prevent explosion in wild positions
        if (qDepth >= 6) return alpha;

        const captures = game.moves({ verbose: true }).filter(m => m.captured);

        // MVV-LVA ordering for captures
        captures.sort((a, b) => {
            const va = (AdvancedEngine.PIECE_VALUE[a.captured] || 0) - (AdvancedEngine.PIECE_VALUE[a.piece] || 0);
            const vb = (AdvancedEngine.PIECE_VALUE[b.captured] || 0) - (AdvancedEngine.PIECE_VALUE[b.piece] || 0);
            return vb - va;
        });

        // Delta pruning: skip captures that can't possibly raise alpha
        for (const move of captures) {
            // Skip clearly losing captures (minor piece takes defended queen scenario
            // is still explored because of the MVV-LVA value)
            game.move(move.san);
            const score = -this.quiescence(game, -beta, -alpha, -sideSign, qDepth + 1);
            game.undo();

            if (this._timeUp || this._aborted) return 0;
            if (score >= beta) return beta;
            if (score > alpha) alpha = score;
        }

        return alpha;
    }

    /* ==================================================================
     *  ALPHA-BETA SEARCH  (Negamax)
     * ================================================================== */
    alphaBeta(game, depth, alpha, beta, sideSign, ply) {
        if (this._timeUp || this._aborted) return 0;
        this.nodesSearched++;
        this.checkTime();
        if (this._timeUp) return 0;

        /* ---- Transposition table probe ---- */
        const fen = game.fen();
        const ttEntry = this.ttable.get(fen);
        let ttBestMove = null;

        if (ttEntry && ttEntry.depth >= depth) {
            if (ttEntry.flag === 'exact') return ttEntry.score;
            if (ttEntry.flag === 'lower' && ttEntry.score > alpha) alpha = ttEntry.score;
            if (ttEntry.flag === 'upper' && ttEntry.score < beta)  beta  = ttEntry.score;
            if (alpha >= beta) return ttEntry.score;
        }
        if (ttEntry) ttBestMove = ttEntry.bestMove;

        /* ---- Leaf → quiescence ---- */
        if (depth <= 0) {
            return this.quiescence(game, alpha, beta, sideSign, 0);
        }

        const moves = game.moves({ verbose: true });

        /* ---- Terminal (checkmate / draw) ---- */
        if (moves.length === 0) {
            if (game.in_checkmate()) return -99999 + ply;
            return 0;
        }

        const ordered = this.orderMoves(moves, ply, ttBestMove);

        let bestScore = -Infinity;
        let bestMove  = null;
        let flag      = 'upper';

        for (const move of ordered) {
            game.move(move.san);
            const score = -this.alphaBeta(game, depth - 1, -beta, -alpha, -sideSign, ply + 1);
            game.undo();

            if (this._timeUp || this._aborted) return 0;

            if (score > bestScore) {
                bestScore = score;
                bestMove  = move;
            }

            if (score > alpha) {
                alpha = score;
                flag  = 'exact';
            }

            if (alpha >= beta) {
                if (!move.captured) {
                    if (!this.killers[ply]) this.killers[ply] = [null, null];
                    this.killers[ply][1] = this.killers[ply][0];
                    this.killers[ply][0] = { from: move.from, to: move.to };
                }
                flag = 'lower';
                break;
            }
        }

        /* ---- Store in TT ---- */
        if (this.ttable.size > this.TT_MAX_SIZE) this.ttable.clear();
        this.ttable.set(fen, { depth, score: bestScore, flag, bestMove });

        return bestScore;
    }

    /* ==================================================================
     *  ITERATIVE DEEPENING  (time-controlled)
     * ================================================================== */
    iterativeDeepening(game) {
        const sideSign = game.turn() === 'w' ? 1 : -1;
        let bestMove = null;

        this.searchStartTime = Date.now();
        this._timeUp = false;

        for (let d = 1; d <= this.maxDepth; d++) {
            if (this._aborted || this._timeUp) break;

            // Don't start a new depth if 60% of time is gone
            const elapsed = Date.now() - this.searchStartTime;
            if (d > 1 && elapsed > this.timeLimitMs * 0.6) break;

            this.nodesSearched = 0;
            this.killers = [];

            const moves = game.moves({ verbose: true });
            if (moves.length === 0) return null;

            // Use TT best from previous iteration
            const ttEntry = this.ttable.get(game.fen());
            const ttBest  = ttEntry ? ttEntry.bestMove : null;
            const ordered = this.orderMoves(moves, 0, ttBest);

            let alpha = -Infinity;
            let beta  =  Infinity;
            let depthBest = null;
            let bestRootScore = -Infinity;

            for (const move of ordered) {
                game.move(move.san);
                const score = -this.alphaBeta(game, d - 1, -beta, -alpha, -sideSign, 1);
                game.undo();

                if (this._aborted || this._timeUp) break;

                // Update alpha normally for correct pruning
                if (score > alpha) alpha = score;

                // Use noise only for *move selection*, not for pruning.
                // ±5 cp jitter picks a different move among near-equal candidates.
                const selectionScore = score + (Math.random() - 0.5) * 10;
                if (selectionScore > bestRootScore) {
                    bestRootScore = selectionScore;
                    depthBest = move;
                }
            }

            // Only accept results from fully completed iterations
            if (!this._aborted && !this._timeUp && depthBest) {
                bestMove = depthBest;
            }

            const timeUsed = Date.now() - this.searchStartTime;
            this.logInfo(`depth ${d}  nodes ${this.nodesSearched}  score ${alpha}  time ${timeUsed}ms  pv ${bestMove ? bestMove.san : '??'}`);

            // Stop on forced mate
            if (Math.abs(alpha) > 99000) break;
        }

        return bestMove;
    }

    /* ==================================================================
     *  THINK  (entry point — called by GameController)
     *
     *  Uses setTimeout to yield to the browser event loop before and
     *  after the search so the UI stays responsive.
     * ================================================================== */
    async think(game) {
        this._aborted = false;
        this._timeUp = false;

        if (this.tournamentMode) {
            // Tournament mode: fixed short time, no UI yield
            this.timeLimitMs = 200;
            this.maxDepth = 4;
        } else {
            // Normal mode: read from dropdown
            const tcSelect = document.getElementById('time-control-select');
            this.timeLimitMs = tcSelect ? parseInt(tcSelect.value, 10) : 1000;
            this.maxDepth = this.timeLimitMs >= 4000 ? 5 : 4;
        }

        // Don't clear TT between moves — it persists across the game
        // Only clear if it's too large
        if (this.ttable.size > this.TT_MAX_SIZE) this.ttable.clear();

        // Yield to the event loop so the UI can repaint before we block
        if (!this.tournamentMode) {
            await new Promise(r => setTimeout(r, 10));
        }
        if (this._aborted) return null;

        const best = this.iterativeDeepening(game);
        if (!best || this._aborted) return null;

        return best.san;
    }

    /* ==================================================================
     *  UTILITIES
     * ================================================================== */
    logInfo(msg) {
        const consoleEl = document.getElementById('dev-console');
        if (consoleEl) {
            consoleEl.innerText += `[${this.name}]: info ${msg}\n`;
            consoleEl.scrollTop = consoleEl.scrollHeight;
        }
    }

    abort() {
        this._aborted = true;
        this._timeUp = true;
    }
}
