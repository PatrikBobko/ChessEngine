class SidebarControls {
    constructor() {
        this.btnNewGame = document.getElementById('btn-new-game');
        this.whiteSelect = document.getElementById('white-player-select');
        this.blackSelect = document.getElementById('black-player-select');
        
        this.btnToggleEngine = document.getElementById('btn-toggle-engine');
        this.btnForceMove = document.getElementById('btn-force-move');

        this.evalFill = document.getElementById('eval-fill');
        
        this.onNewGameRequest = null;
        this.onToggleEngine = null;
        this.onForceMove = null;

        this._initEvents();
    }

    _initEvents() {
        const triggerNewGame = () => {
            if (this.onNewGameRequest) {
                this.onNewGameRequest({
                    white: this.whiteSelect.value,
                    black: this.blackSelect.value
                });
            }
        };

        this.btnNewGame.addEventListener('click', triggerNewGame);
        this.whiteSelect.addEventListener('change', triggerNewGame);
        this.blackSelect.addEventListener('change', triggerNewGame);

        this.btnToggleEngine.addEventListener('click', () => {
            if (this.onToggleEngine) this.onToggleEngine();
        });

        this.btnForceMove.addEventListener('click', () => {
            if (this.onForceMove) this.onForceMove();
        });
    }

    setEnginePaused(isPaused) {
        if (isPaused) {
            this.btnToggleEngine.innerHTML = '<i class="fa-solid fa-play"></i> Resume';
            this.btnToggleEngine.classList.add('primary');
            this.btnToggleEngine.classList.remove('secondary');
        } else {
            this.btnToggleEngine.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
            this.btnToggleEngine.classList.add('secondary');
            this.btnToggleEngine.classList.remove('primary');
        }
    }

    updateNames(whiteName, blackName) {
        document.getElementById('white-player-name').innerText = whiteName;
        document.getElementById('black-player-name').innerText = blackName;
    }

    // Engine evaluation display (simulated for now, assumes value is from -10 to +10, or cp)
    updateEval(scoreCp) {
        const score = Math.max(-10, Math.min(10, scoreCp / 100));
        // Map -10 - 10 to 0 - 100%
        const percent = ((score + 10) / 20) * 100;
        this.evalFill.style.width = `${percent}%`;
    }
}
