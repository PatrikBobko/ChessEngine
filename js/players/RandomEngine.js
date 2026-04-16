class RandomEngine extends Player {
    constructor(color) {
        super(color);
        this.name = "Random Engine";
        this.isHuman = false;
        this._aborted = false;
    }

    async think(game) {
        this._aborted = false;
        
        // Artificial delay to simulate "thinking" to be visible to human
        await new Promise(r => setTimeout(r, 500));
        
        if (this._aborted) return null;

        const moves = game.moves({ verbose: true });
        if (moves.length === 0) return null;
        
        const randomIndex = Math.floor(Math.random() * moves.length);
        const selectedMove = moves[randomIndex];
        
        // Return move string in short san or standard format
        return selectedMove.san;
    }

    abort() {
        this._aborted = true;
    }
}
