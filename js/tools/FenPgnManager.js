class FenPgnManager {
    constructor() {
        this.fenInput = document.getElementById('fen-input');
        this.pgnOutput = document.getElementById('pgn-output');
        
        this.btnLoadFen = document.getElementById('btn-load-fen');
        this.btnCopyFen = document.getElementById('btn-copy-fen');
        this.btnCopyPgn = document.getElementById('btn-copy-pgn');

        this.onLoadFenRequest = null;

        this._initEvents();
    }

    _initEvents() {
        this.btnLoadFen.addEventListener('click', () => {
            if (this.onLoadFenRequest) {
                this.onLoadFenRequest(this.fenInput.value.trim());
            }
        });

        this.btnCopyFen.addEventListener('click', () => {
            navigator.clipboard.writeText(this.fenInput.value);
            this.btnCopyFen.innerText = "Copied!";
            setTimeout(() => this.btnCopyFen.innerText = "Copy", 1500);
        });

        this.btnCopyPgn.addEventListener('click', () => {
            navigator.clipboard.writeText(this.pgnOutput.value);
            this.btnCopyPgn.innerText = "Copied!";
            setTimeout(() => this.btnCopyPgn.innerText = "Copy PGN", 1500);
        });
    }

    updateDisplay(fen, pgn) {
        this.fenInput.value = fen;
        this.pgnOutput.value = pgn;
    }
}
