/**
 * Tournament — Automated Engine-vs-Engine Match Runner
 *
 * Runs round-robin or pairwise matches between chess engines,
 * collects win/draw/loss statistics, and calculates relative ELO.
 *
 * Games are played headlessly (no UI board updates) for maximum speed.
 * Engines are given a `tournamentMode = true` flag so they can skip
 * cosmetic delays.
 */
class Tournament {
    constructor() {
        this.results = {};   // { "A vs B": { wins, draws, losses } }
        this.isRunning = false;
        this._aborted = false;

        // Callbacks for UI updates
        this.onProgress = null;   // (current, total, detail) => {}
        this.onComplete = null;   // (results) => {}
        this.onGameEnd  = null;   // (gameNum, result, detail) => {}
    }

    /* ==================================================================
     *  Play a single headless game, returns 'white' | 'black' | 'draw'
     * ================================================================== */
    async playGame(white, black, maxMoves = 200) {
        const game = new Chess();
        let moveCount = 0;

        while (!game.game_over() && moveCount < maxMoves) {
            if (this._aborted) {
                white.abort();
                black.abort();
                return 'aborted';
            }

            const current = game.turn() === 'w' ? white : black;

            try {
                const move = await current.think(game);

                if (this._aborted) return 'aborted';
                if (!move) break;

                const result = game.move(move, { sloppy: true });
                if (!result) {
                    // Invalid move — the engine that played it loses
                    console.warn(`Invalid move: ${move} by ${current.name}`);
                    return game.turn() === 'w' ? 'black' : 'white';
                }

                moveCount++;
            } catch (e) {
                console.error(`Engine error: ${e}`);
                break;
            }
        }

        if (game.in_checkmate()) {
            return game.turn() === 'w' ? 'black' : 'white';
        }
        return 'draw';
    }

    /* ==================================================================
     *  Run a match: N games between two engine factories
     *
     *  engineFactoryA(color) → Player instance
     *  Colors alternate each game for fairness
     * ================================================================== */
    async runMatch(nameA, factoryA, nameB, factoryB, numGames) {
        const key = `${nameA} vs ${nameB}`;
        let wins = 0, draws = 0, losses = 0;

        for (let i = 0; i < numGames; i++) {
            if (this._aborted) break;

            // Alternate colors: even games A=white, odd games A=black
            const aIsWhite = (i % 2 === 0);
            const white = aIsWhite ? factoryA('w') : factoryB('w');
            const black = aIsWhite ? factoryB('b') : factoryA('b');

            // Enable tournament mode (skip delays, short time limits)
            white.tournamentMode = true;
            black.tournamentMode = true;

            const result = await this.playGame(white, black);

            // Cleanup Stockfish workers etc.
            if (typeof white.destroy === 'function') white.destroy();
            if (typeof black.destroy === 'function') black.destroy();

            if (result === 'aborted') break;

            // Count from A's perspective
            if (aIsWhite) {
                if (result === 'white') wins++;
                else if (result === 'black') losses++;
                else draws++;
            } else {
                if (result === 'black') wins++;
                else if (result === 'white') losses++;
                else draws++;
            }

            if (this.onGameEnd) {
                this.onGameEnd(i + 1, result, `${nameA}(${aIsWhite ? 'W' : 'B'}) vs ${nameB}(${aIsWhite ? 'B' : 'W'})`);
            }

            // Yield to UI
            await new Promise(r => setTimeout(r, 5));
        }

        this.results[key] = { wins, draws, losses, nameA, nameB };
        return { wins, draws, losses };
    }

    /* ==================================================================
     *  Run a full round-robin tournament
     *
     *  engines: [{ name, factory }]
     *  gamesPerMatch: number of games per pair
     * ================================================================== */
    async runRoundRobin(engines, gamesPerMatch) {
        this.isRunning = true;
        this._aborted = false;
        this.results = {};

        const totalPairs = (engines.length * (engines.length - 1)) / 2;
        let pairsDone = 0;

        for (let i = 0; i < engines.length; i++) {
            for (let j = i + 1; j < engines.length; j++) {
                if (this._aborted) break;

                const a = engines[i];
                const b = engines[j];

                if (this.onProgress) {
                    this.onProgress(pairsDone, totalPairs,
                        `Playing: ${a.name} vs ${b.name}`);
                }

                await this.runMatch(a.name, a.factory, b.name, b.factory, gamesPerMatch);
                pairsDone++;
            }
        }

        this.isRunning = false;

        const eloResults = this.calculateElo(engines);

        if (this.onComplete) {
            this.onComplete(eloResults);
        }

        return eloResults;
    }

    /* ==================================================================
     *  ELO Calculation from pairwise results
     *
     *  Uses the standard formula:
     *    score = (wins + draws/2) / total_games
     *    ELO_diff = 400 × log₁₀(score / (1 - score))
     *
     *  Anchors the weakest engine at ELO 200 and builds up from there.
     * ================================================================== */
    calculateElo(engines) {
        const names = engines.map(e => e.name);
        const eloMap = {};

        // Initialize all engines at 1000
        names.forEach(n => eloMap[n] = 1000);

        // Iterative ELO estimation (simple pairwise adjustment)
        // Run 50 iterations for convergence
        for (let iter = 0; iter < 50; iter++) {
            for (const key in this.results) {
                const r = this.results[key];
                const total = r.wins + r.draws + r.losses;
                if (total === 0) continue;

                const scoreA = (r.wins + r.draws * 0.5) / total;
                if (scoreA <= 0 || scoreA >= 1) {
                    // Perfect score — use large but finite diff
                    const diff = scoreA >= 1 ? 400 : -400;
                    const mid = (eloMap[r.nameA] + eloMap[r.nameB]) / 2;
                    eloMap[r.nameA] = mid + diff / 2;
                    eloMap[r.nameB] = mid - diff / 2;
                } else {
                    const eloDiff = 400 * Math.log10(scoreA / (1 - scoreA));
                    const mid = (eloMap[r.nameA] + eloMap[r.nameB]) / 2;
                    eloMap[r.nameA] = mid + eloDiff / 2;
                    eloMap[r.nameB] = mid - eloDiff / 2;
                }
            }
        }

        // Normalize: anchor the lowest at 200
        const minElo = Math.min(...Object.values(eloMap));
        const offset = 200 - minElo;
        names.forEach(n => eloMap[n] = Math.round(eloMap[n] + offset));

        // Build results array sorted by ELO
        const sorted = names
            .map(name => ({
                name,
                elo: eloMap[name],
                results: this._getResultsFor(name)
            }))
            .sort((a, b) => b.elo - a.elo);

        return sorted;
    }

    _getResultsFor(name) {
        const out = {};
        for (const key in this.results) {
            const r = this.results[key];
            if (r.nameA === name) {
                out[r.nameB] = `+${r.wins} =${r.draws} -${r.losses}`;
            } else if (r.nameB === name) {
                out[r.nameA] = `+${r.losses} =${r.draws} -${r.wins}`;
            }
        }
        return out;
    }

    abort() {
        this._aborted = true;
        this.isRunning = false;
    }
}
