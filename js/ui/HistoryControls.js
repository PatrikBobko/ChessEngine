class HistoryControls {
    constructor() {
        this.tbody = document.getElementById('move-list-body');
        
        this.btnStart = document.getElementById('btn-hist-start');
        this.btnPrev = document.getElementById('btn-hist-prev');
        this.btnNext = document.getElementById('btn-hist-next');
        this.btnEnd = document.getElementById('btn-hist-end');

        this.onNavigate = null; // Callback passing a target ply (int)
        
        this.moves = [];
        this.currentPly = 0;

        this._initEvents();
    }

    _initEvents() {
        this.btnStart.addEventListener('click', () => this._requestNav(0));
        this.btnPrev.addEventListener('click', () => this._requestNav(this.currentPly - 1));
        this.btnNext.addEventListener('click', () => this._requestNav(this.currentPly + 1));
        this.btnEnd.addEventListener('click', () => this._requestNav(this.moves.length));
    }

    _requestNav(ply) {
        if (!this.onNavigate) return;
        const target = Math.max(0, Math.min(ply, this.moves.length));
        if (target !== this.currentPly) {
            this.onNavigate(target);
        }
    }

    /**
     * @param {Array<string>} sanMoves - Array of SAN move strings
     * @param {number} currentPly - The ply currently selected
     */
    update(sanMoves, currentPly) {
        this.moves = sanMoves;
        this.currentPly = currentPly;
        this._render();
    }

    _render() {
        this.tbody.innerHTML = '';
        
        // moves are [e4, e5, Nf3, ...] -> plies 1, 2, 3
        // Pair them up
        let numRows = Math.ceil(this.moves.length / 2);
        
        for (let i = 0; i < numRows; i++) {
            const tr = document.createElement('tr');
            
            // Move Number
            const tdNum = document.createElement('td');
            tdNum.className = 'move-num';
            tdNum.innerText = (i + 1) + ".";
            tr.appendChild(tdNum);

            // White Move (Ply: i*2 + 1)
            const wTargetPly = i * 2 + 1;
            const tdW = document.createElement('td');
            tdW.className = 'move white';
            if (this.currentPly === wTargetPly) tdW.classList.add('active');
            tdW.innerText = this.moves[wTargetPly - 1] || '';
            if (this.moves[wTargetPly - 1]) {
                tdW.addEventListener('click', () => this._requestNav(wTargetPly));
            }
            tr.appendChild(tdW);

            // Black Move (Ply: i*2 + 2)
            const bTargetPly = i * 2 + 2;
            const tdB = document.createElement('td');
            tdB.className = 'move black';
            if (this.currentPly === bTargetPly) tdB.classList.add('active');
            tdB.innerText = this.moves[bTargetPly - 1] || '';
            if (this.moves[bTargetPly - 1]) {
                tdB.addEventListener('click', () => this._requestNav(bTargetPly));
            }
            tr.appendChild(tdB);

            this.tbody.appendChild(tr);
        }

        // Auto-scroll to bottom if viewing the end
        if (this.currentPly === this.moves.length) {
            const container = document.getElementById('move-list-container');
            container.scrollTop = container.scrollHeight;
        }
    }
}
