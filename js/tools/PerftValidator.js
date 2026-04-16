class PerftValidator {
    constructor(gameController) {
        this.gameController = gameController;
        this.btnRunPerft = document.getElementById('btn-run-perft');
        this.depthInput = document.getElementById('perft-depth');
        this.consoleOut = document.getElementById('dev-console');

        this.btnRunPerft.addEventListener('click', () => this.run());
    }

    log(msg) {
        this.consoleOut.innerText += `\n[Perft]: ${msg}`;
        this.consoleOut.scrollTop = this.consoleOut.scrollHeight;
    }

    run() {
        const depth = parseInt(this.depthInput.value) || 1;
        const startFen = this.gameController.game.fen();
        
        this.log(`Running Perft(${depth}) on ${startFen}`);
        this.btnRunPerft.disabled = true;

        // Use a slight timeout so the UI can update before heavy blocking computation
        setTimeout(() => {
            const t0 = performance.now();
            let nodes = 0;

            const proxyGame = new window.Chess(startFen);

            const perft = (g, d) => {
                const moves = g.moves({ verbose: true });
                let n = 0;

                if (d === 1) return moves.length;

                for (let i = 0; i < moves.length; i++) {
                    g.move(moves[i]);
                    n += perft(g, d - 1);
                    g.undo();
                }
                return n;
            };

            if (depth === 0) nodes = 1; else nodes = perft(proxyGame, depth);

            const t1 = performance.now();
            const timeElapsed = (t1 - t0) / 1000;
            const nps = Math.floor(nodes / timeElapsed);

            this.log(`Nodes: ${nodes}`);
            this.log(`Time: ${timeElapsed.toFixed(3)}s`);
            this.log(`NPS: ${nps}`);
            this.log('--- Done ---');

            this.btnRunPerft.disabled = false;
        }, 50);
    }
}
