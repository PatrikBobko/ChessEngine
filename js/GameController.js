class GameController {
    constructor(ui, fenManager, sidebar, historyControls) {
        this.game = new window.Chess();
        this.ui = ui;
        this.fenManager = fenManager;
        this.sidebar = sidebar;
        this.historyControls = historyControls;

        this.whitePlayer = null;
        this.blackPlayer = null;
        this.isRunning = false;

        this.startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
        this.moveHistory = [];
        this.currentPly = 0;

        this.onGameOver = () => { };
    }

    setPlayers(whitePlayer, blackPlayer) {
        if (this.whitePlayer) this.whitePlayer.abort();
        if (this.blackPlayer) this.blackPlayer.abort();

        this.whitePlayer = whitePlayer;
        this.blackPlayer = blackPlayer;
    }

    startNewGame(fen) {
        this.isRunning = false;
        if (this.whitePlayer) this.whitePlayer.abort();
        if (this.blackPlayer) this.blackPlayer.abort();

        // If no FEN provided, load standard start
        this.startingFen = fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
        this.moveHistory = [];
        this.currentPly = 0;

        const loaded = this.game.load(this.startingFen);
        if (!loaded) {
            console.error("Failed to load FEN:", this.startingFen);
            return false;
        }

        this.ui.updateBoard(this.game);
        this.fenManager.updateDisplay(this.game.fen(), this.game.pgn());
        if (this.historyControls) this.historyControls.update(this.moveHistory, this.currentPly);

        if (this.sidebar) this.sidebar.setEnginePaused(false);
        this.isRunning = true;
        this.nextTurn();
        return true;
    }

    togglePause() {
        if (this.isRunning) {
            this.isRunning = false;
            // Stop whatever is thinking, including HumanPlayers waiting for UI.
            if (this.whitePlayer) this.whitePlayer.abort();
            if (this.blackPlayer) this.blackPlayer.abort();

            // Re-bind input manually so users can play around while paused
            this.ui.enableInput(this.game.turn(), (m) => this.handleDirectMove(m));
            return true; // isPaused = true
        } else {
            // Resume
            if (this.currentPly !== this.moveHistory.length) {
                // If browsing history, snap back to present and resume
                this.gotoPly(this.moveHistory.length);
            } else {
                this.isRunning = true;
                this.nextTurn();
            }
            return false; // isPaused = false
        }
    }

    forceMove() {
        if (!this.isRunning) return;
        const turnColor = this.game.turn();
        const currentPlayer = turnColor === 'w' ? this.whitePlayer : this.blackPlayer;

        if (currentPlayer && !currentPlayer.isHuman) {
            if (typeof currentPlayer.forceMove === 'function') {
                currentPlayer.forceMove(); // Explicitly trigger the engine's 'stop' command
            }
        }
    }

    handleDirectMove(moveObj) {
        const moveResult = this.game.move(moveObj, { sloppy: true });
        if (moveResult) {
            // Truncate history if we override the past
            if (this.currentPly < this.moveHistory.length) {
                this.moveHistory = this.moveHistory.slice(0, this.currentPly);
            }

            this.moveHistory.push(moveResult.san);
            this.currentPly++;

            this.ui.animateMove(moveResult);
            this.ui.updateBoard(this.game);
            this.fenManager.updateDisplay(this.game.fen(), this.game.pgn());
            if (this.historyControls) this.historyControls.update(this.moveHistory, this.currentPly);

            // Automatically resume the active game loop after any manual override!
            this.isRunning = true;
            if (this.sidebar) this.sidebar.setEnginePaused(false);
            this.nextTurn();
        } else {
            this.ui.updateBoard(this.game);
        }
    }

    gotoPly(ply) {
        const target = Math.max(0, Math.min(ply, this.moveHistory.length));
        if (target === this.currentPly) return;

        // Suspend current engine calculations and freeze the game loop
        this.isRunning = false;
        if (this.whitePlayer) this.whitePlayer.abort();
        if (this.blackPlayer) this.blackPlayer.abort();

        this.currentPly = target;

        // Reconstruct exact state at ply
        this.game.load(this.startingFen);
        for (let i = 0; i < this.currentPly; i++) {
            this.game.move(this.moveHistory[i]);
        }

        this.ui.updateBoard(this.game);
        this.fenManager.updateDisplay(this.game.fen(), this.game.pgn());
        if (this.historyControls) this.historyControls.update(this.moveHistory, this.currentPly);

        // Resume active gameplay loop ONLY if we're exactly at the end of the timeline
        if (this.currentPly === this.moveHistory.length) {
            this.isRunning = true;
            this.nextTurn();
        } else {
            // Allow Free Play while browsing
            this.ui.enableInput(this.game.turn(), (m) => this.handleDirectMove(m));
        }
    }

    async nextTurn() {
        if (!this.isRunning) return;

        if (this.game.game_over()) {
            this.handleGameOver();
            return;
        }

        const turnColor = this.game.turn(); // 'w' or 'b'
        const currentPlayer = turnColor === 'w' ? this.whitePlayer : this.blackPlayer;

        try {
            // Player thinks and returns a move string (SAN e2e4 or standard algebraic Nf3)
            const move = await currentPlayer.think(this.game);

            if (!this.isRunning) return; // aborted during think
            if (!move) return; // engine failed or returned null

            // Try to apply move
            const moveResult = this.game.move(move, { sloppy: true });
            if (moveResult) {
                // Valid move
                this.moveHistory.push(moveResult.san);
                this.currentPly++;

                this.ui.animateMove(moveResult);
                this.ui.updateBoard(this.game);
                this.fenManager.updateDisplay(this.game.fen(), this.game.pgn());
                if (this.historyControls) this.historyControls.update(this.moveHistory, this.currentPly);

                // Keep engine output clean or notify
                // We'll queue the next turn
                setTimeout(() => this.nextTurn(), 50); // slight delay for ui repaint
            } else {
                console.error(`Invalid move returned by ${currentPlayer.name}: ${move}`);
                // In a robust engine framework, we might want to fail the engine here
            }

        } catch (e) {
            console.error(e);
        }
    }

    handleGameOver() {
        this.isRunning = false;
        let result = "Draw";
        if (this.game.in_checkmate()) {
            result = this.game.turn() === 'w' ? "Black Wins (Checkmate)" : "White Wins (Checkmate)";
        } else if (this.game.in_stalemate()) {
            result = "Draw (Stalemate)";
        } else if (this.game.in_threefold_repetition()) {
            result = "Draw (Repetition)";
        } else if (this.game.insufficient_material()) {
            result = "Draw (Insufficient Material)";
        } else if (this.game.in_draw()) {
            result = "Draw (50-move rule)";
        }

        console.log(`Game Over: ${result}`);
        if (this.onGameOver) this.onGameOver(result);
    }

    stop() {
        this.isRunning = false;
        if (this.whitePlayer) this.whitePlayer.abort();
        if (this.blackPlayer) this.blackPlayer.abort();
    }
}
