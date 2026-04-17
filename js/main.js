// All classes are loaded globally from index.html

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize UI Elements
    const boardUi = new ChessBoardUI('chessboard');
    const sidebar = new SidebarControls();
    const fenManager = new FenPgnManager();
    const historyControls = new HistoryControls();
    
    // 2. Initialize Game Controller
    const gameCtrl = new GameController(boardUi, fenManager, sidebar, historyControls);

    // 3. Initialize Dev Tools
    const perftValidator = new PerftValidator(gameCtrl);

    // 4. Wire up events
    // Helper: create a player from a dropdown value and color
    const createPlayer = (type, color) => {
        switch (type) {
            case 'human':    return new HumanPlayer(color, boardUi);
            case 'naive':    return new NaiveEngine(color);
            case 'advanced': return new AdvancedEngine(color);
            case 'random':
            default:         return new RandomEngine(color);
        }
    };

    sidebar.onNewGameRequest = (config) => {
        const whitePlayer = createPlayer(config.white, 'w');
        const blackPlayer = createPlayer(config.black, 'b');

        sidebar.updateNames(whitePlayer.name, blackPlayer.name);
        gameCtrl.setPlayers(whitePlayer, blackPlayer);
        
        // Explicitly clear FEN to restart from scratch when players change
        fenManager.fenInput.value = '';
        gameCtrl.startNewGame();
    };

    fenManager.onLoadFenRequest = (fen) => {
        gameCtrl.startNewGame(fen);
    };

    sidebar.onToggleEngine = () => {
        const isPaused = gameCtrl.togglePause();
        sidebar.setEnginePaused(isPaused);
    };

    sidebar.onForceMove = () => {
        gameCtrl.forceMove();
    };

    historyControls.onNavigate = (ply) => {
        gameCtrl.gotoPly(ply);
    };

    gameCtrl.onGameOver = (result) => {
        document.getElementById('dev-console').innerText += `\n[Game] ${result}`;
        sidebar.updateEval(0);
    };

    // 5. Start initial game (Human vs Advanced Engine)
    sidebar.updateNames("Human", "Advanced Engine");
    gameCtrl.setPlayers(new HumanPlayer('w', boardUi), new AdvancedEngine('b'));
    gameCtrl.startNewGame();
});
