/**
 * StockfishEngine — Stockfish loaded via CDN as a Web Worker
 *
 * Creates a Blob-URL Web Worker that imports Stockfish from jsDelivr,
 * bypassing the file:// cross-origin restriction. Communicates via
 * standard UCI protocol.
 *
 * Uses stockfish.js v10 (pure ASM.js) which works as a direct Web Worker
 * with simple postMessage/onmessage — no promise-based init required.
 *
 * Configurable depth allows creating multiple strength presets:
 *   - Depth 1  ≈  ~800 ELO   (very weak)
 *   - Depth 3  ≈  ~1400 ELO  (beginner)
 *   - Depth 5  ≈  ~1800 ELO  (intermediate)
 *   - Depth 8  ≈  ~2200 ELO  (strong)
 */
class StockfishEngine extends Player {
    constructor(color, depth = 5, label) {
        super(color);
        this.depth = depth;
        this.name = label || `Stockfish (d${depth})`;
        this.isHuman = false;

        this._resolveMove = null;
        this._aborted = false;
        this.worker = null;
        this._ready = false;
        this._initPromise = this._initWorker();
    }

    /* -------------------------------------------------------------- */
    /*  Create a Blob-URL worker that imports Stockfish from CDN       */
    /* -------------------------------------------------------------- */
    async _initWorker() {
        // stockfish.js v10.0.2 is a pure ASM.js build that works as a
        // simple Web Worker out of the box (postMessage / onmessage).
        // Using importScripts inside a Blob URL bypasses file:// CORS.
        const workerCode = `importScripts('https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js');`;

        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);

        try {
            this.worker = new Worker(blobUrl);
        } catch (e) {
            console.error('[StockfishEngine] Failed to create worker:', e);
            return;
        }

        // Wait for the engine to respond to 'uci'
        await new Promise((resolve) => {
            const handler = (e) => {
                const msg = typeof e.data === 'string' ? e.data : '';
                if (msg.startsWith('uciok')) {
                    this._ready = true;
                    resolve();
                }
            };
            this.worker.addEventListener('message', handler);

            // Timeout after 15 seconds
            setTimeout(() => {
                if (!this._ready) {
                    console.error('[StockfishEngine] Stockfish init timed out');
                    this.worker.removeEventListener('message', handler);
                    resolve();
                }
            }, 15000);

            this.worker.postMessage('uci');
        });

        // Now bind the real message handler
        this.worker.onmessage = this._handleMessage.bind(this);
        this.worker.postMessage('isready');
    }

    /* -------------------------------------------------------------- */
    /*  Handle UCI messages from Stockfish                            */
    /* -------------------------------------------------------------- */
    _handleMessage(e) {
        const msg = typeof e.data === 'string' ? e.data : '';

        if (msg.startsWith('bestmove')) {
            const parts = msg.split(' ');
            if (this._resolveMove && !this._aborted) {
                // Stockfish returns moves in long algebraic (e.g., e2e4)
                const move = parts[1];
                this._resolveMove(move);
                this._resolveMove = null;
            }
        } else if (msg.startsWith('info') && !this.tournamentMode) {
            this._logInfo(msg);
        }
    }

    _logInfo(msg) {
        const consoleEl = document.getElementById('dev-console');
        if (consoleEl) {
            consoleEl.innerText += `[${this.name}]: ${msg}\n`;
            consoleEl.scrollTop = consoleEl.scrollHeight;
        }
    }

    /* -------------------------------------------------------------- */
    /*  Think — wait for engine init, then search                     */
    /* -------------------------------------------------------------- */
    async think(game) {
        this._aborted = false;

        // Wait for Stockfish to finish loading
        await this._initPromise;

        if (!this.worker || !this._ready || this._aborted) return null;

        return new Promise((resolve) => {
            this._resolveMove = resolve;

            this.worker.postMessage(`position fen ${game.fen()}`);
            this.worker.postMessage(`go depth ${this.depth}`);
        });
    }

    /* -------------------------------------------------------------- */
    /*  Control                                                       */
    /* -------------------------------------------------------------- */
    abort() {
        this._aborted = true;
        if (this.worker) {
            this.worker.postMessage('stop');
        }
        if (this._resolveMove) {
            this._resolveMove(null);
            this._resolveMove = null;
        }
    }

    forceMove() {
        if (this.worker && this._resolveMove && !this._aborted) {
            this.worker.postMessage('stop');
        }
    }

    destroy() {
        this.abort();
        if (this.worker) {
            this.worker.postMessage('quit');
            this.worker.terminate();
            this.worker = null;
        }
    }
}
