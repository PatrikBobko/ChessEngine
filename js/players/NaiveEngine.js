/**
 * NaiveEngine — Greedy Material Evaluator (Depth 1)
 *
 * For every legal move, this engine applies it, counts the total material
 * on both sides, and picks the move that maximises its own advantage.
 * Captures, promotions, and checkmates are all handled implicitly because
 * we simply evaluate the *resulting* position.
 *
 * Beyond raw material it also considers:
 *  - Mobility (more legal moves = better)
 *  - Check bonus (giving check restricts the opponent)
 *  - Mating drive (when winning big, push the enemy king to the edge
 *    and centralise our own king to enable checkmate)
 *
 * This is the first step above pure random play and demonstrates why
 * deeper search is needed — the engine still has no concept of future
 * consequences beyond the immediate move.
 */
class NaiveEngine extends Player {
    constructor(color) {
        super(color);
        this.name = "Naive Engine";
        this.isHuman = false;
        this._aborted = false;
    }

    /* ------------------------------------------------------------------ */
    /*  Piece values (centipawns)                                          */
    /* ------------------------------------------------------------------ */
    static PIECE_VALUE = {
        p: 100,
        n: 320,
        b: 330,
        r: 500,
        q: 900,
        k: 0      // King is invaluable — not counted in material sums
    };

    /* ------------------------------------------------------------------ */
    /*  Helper: find king square for a given color                         */
    /* ------------------------------------------------------------------ */
    findKing(board, color) {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const sq = board[r][c];
                if (sq && sq.type === 'k' && sq.color === color) {
                    return { r, c };
                }
            }
        }
        return { r: 3, c: 3 }; // fallback (should never happen)
    }

    /* ------------------------------------------------------------------ */
    /*  Helper: distance from centre (0 = centre, higher = edge/corner)   */
    /* ------------------------------------------------------------------ */
    centreDistance(r, c) {
        // Manhattan distance from the centre (3.5, 3.5)
        return Math.abs(r - 3.5) + Math.abs(c - 3.5);
    }

    /* ------------------------------------------------------------------ */
    /*  Evaluation: material + mobility + mating drive                    */
    /* ------------------------------------------------------------------ */
    evaluate(game) {
        const board  = game.board();   // 8×8 array of {type, color} | null
        const myColor  = this.color;
        const oppColor = myColor === 'w' ? 'b' : 'w';
        let score = 0;

        /* --- Material --- */
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const sq = board[r][c];
                if (!sq) continue;
                const value = NaiveEngine.PIECE_VALUE[sq.type] || 0;
                score += sq.color === myColor ? value : -value;
            }
        }

        /* --- Mobility bonus (side-to-move gets its moves counted) --- */
        const mobilityMoves = game.moves().length;
        // If it's our turn, more moves = good; if opponent's turn, more = bad
        if (game.turn() === myColor) {
            score += mobilityMoves * 3;
        } else {
            score -= mobilityMoves * 3;
        }

        /* --- Check bonus --- */
        if (game.in_check()) {
            // Side to move is in check — that's good for us if it's opponent's turn
            score += game.turn() === myColor ? -30 : 30;
        }

        /* --- Mating drive (only when we're significantly ahead) --- */
        if (score > 400) {
            const oppKing = this.findKing(board, oppColor);
            const myKing  = this.findKing(board, myColor);

            // Push opponent king to the edge/corner
            score += this.centreDistance(oppKing.r, oppKing.c) * 15;

            // Bring our king closer to opponent king (for K+R, K+Q mates)
            const kingDist = Math.abs(myKing.r - oppKing.r) + Math.abs(myKing.c - oppKing.c);
            score += (14 - kingDist) * 5;
        }

        return score;
    }

    /* ------------------------------------------------------------------ */
    /*  Think: try every legal move, pick the one with the best score      */
    /* ------------------------------------------------------------------ */
    async think(game) {
        this._aborted = false;

        // Small delay so the UI can repaint between moves
        await new Promise(r => setTimeout(r, 200));
        if (this._aborted) return null;

        const moves = game.moves({ verbose: true });
        if (moves.length === 0) return null;

        let bestScore = -Infinity;
        let bestMoves = [moves[0]]; // track ties to break randomly

        for (const move of moves) {
            game.move(move.san);

            // Immediate checkmate is the best possible outcome
            if (game.in_checkmate()) {
                game.undo();
                return move.san;
            }

            // Stalemate is terrible when we're winning — avoid it
            if (game.in_stalemate()) {
                game.undo();
                continue; // skip stalemating moves unless we have nothing else
            }

            const score = this.evaluate(game);
            game.undo();

            if (score > bestScore) {
                bestScore = score;
                bestMoves = [move];
            } else if (score === bestScore) {
                bestMoves.push(move); // tie — collect for random tiebreak
            }
        }

        // Random tiebreak among equally-scored moves to avoid repetitive play
        const chosen = bestMoves[Math.floor(Math.random() * bestMoves.length)];
        return chosen.san;
    }

    abort() {
        this._aborted = true;
    }
}
