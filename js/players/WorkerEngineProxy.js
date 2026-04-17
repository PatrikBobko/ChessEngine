class WorkerEngineProxy extends Player {
    constructor(color, workerUrl, name = "Custom Engine") {
        super(color);
        this.name = name;
        this.isHuman = false;
        
        try {
            this.worker = new Worker(workerUrl);
            this.worker.onmessage = this.handleWorkerMessage.bind(this);
        } catch (e) {
            console.error(`Failed to load worker from ${workerUrl}`, e);
        }

        this._resolveMove = null;
        this._aborted = false;
    }

    handleWorkerMessage(e) {
        const msg = e.data;
        if (typeof msg === 'string') {
            // Assume UCI protocol for engine communication
            const parts = msg.split(' ');
            
            if (parts[0] === 'info') {
                this.logEngineInfo(msg);
            } else if (parts[0] === 'bestmove') {
                if (this._resolveMove && !this._aborted) {
                    const move = parts[1]; // e.g., e2e4
                    this._resolveMove(move);
                    this._resolveMove = null;
                }
            } else {
                this.logEngineInfo(msg);
            }
        }
    }

    logEngineInfo(msg) {
        const consoleEl = document.getElementById('dev-console');
        if (consoleEl) {
            consoleEl.innerText += `[${this.name}]: ${msg}\n`;
            consoleEl.scrollTop = consoleEl.scrollHeight;
        }
    }

    async think(game) {
        this._aborted = false;
        if (!this.worker) return null;

        return new Promise((resolve) => {
            this._resolveMove = resolve;
            
            // Send standard UCI commands to start thinking
            this.worker.postMessage("isready");
            this.worker.postMessage(`position fen ${game.fen()}`);
            
            // In a real UCI setup, we'd pass true wtime/btime based on GameController
            const timeMs = document.getElementById('time-control-select').value || '1000';
            this.worker.postMessage(`go movetime ${timeMs}`);
        });
    }

    abort() {
        this._aborted = true;
        if (this.worker) {
            this.worker.postMessage("stop");
        }
        if (this._resolveMove) {
            this._resolveMove(null);
            this._resolveMove = null;
        }
    }

    forceMove() {
        if (this.worker && this._resolveMove && !this._aborted) {
            this.worker.postMessage("stop");
        }
    }

    destroy() {
        this.abort();
        if (this.worker) {
            this.worker.terminate();
        }
    }
}
