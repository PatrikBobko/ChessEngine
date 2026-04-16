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
    sidebar.onNewGameRequest = (config) => {
        const whitePlayer = config.white === 'human' 
            ? new HumanPlayer('w', boardUi) 
            : new RandomEngine('w');
            
        const blackPlayer = config.black === 'human'
            ? new HumanPlayer('b', boardUi)
            : new RandomEngine('b');

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

    // 5. Start initial game (Human vs Engine)
    sidebar.updateNames("Human", "Random Engine");
    gameCtrl.setPlayers(new HumanPlayer('w', boardUi), new RandomEngine('b'));
    gameCtrl.startNewGame();
});
