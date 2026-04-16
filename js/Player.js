class Player {
    constructor(color) {
        this.color = color; // 'w' or 'b'
        this.isHuman = false;
        this.name = "Abstract Player";
    }

    /**
     * Called by the GameController when it is this player's turn.
     * @param {Object} game - the chess.js instance
     * @returns {Promise<string|null>} - Returns a move string (SAN or from/to object), or null if game over.
     */
    async think(game) {
        throw new Error("Method 'think()' must be implemented.");
    }

    /**
     * Called to stop the player from thinking if the game resets
     */
    abort() {
        // Optional override
    }
}
