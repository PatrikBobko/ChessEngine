class HumanPlayer extends Player {
    constructor(color, ui) {
        super(color);
        this.name = "Human";
        this.isHuman = true;
        this.ui = ui; // Reference to ChessBoardUI
        this._resolveMove = null;
    }

    async think(game) {
        // For a human, "thinking" means waiting for the UI to report a valid drag-and-drop piece move.
        // We return a Promise that resolves when the user makes a move.
        return new Promise((resolve) => {
            this._resolveMove = resolve;
            
            // Enable dragging for this color in the UI
            this.ui.enableInput(this.color, (move) => {
                // UI calls this callback when a valid move is made
                this.ui.disableInput();
                this._resolveMove = null;
                resolve(move);
            });
        });
    }

    abort() {
        if (this._resolveMove) {
            this.ui.disableInput();
            this._resolveMove(null);
            this._resolveMove = null;
        }
    }
}
