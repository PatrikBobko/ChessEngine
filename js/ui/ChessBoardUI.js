class ChessBoardUI {
    constructor(boardId) {
        this.boardEl = document.getElementById(boardId);
        this.squares = {}; // e.g., {'a1': domElem}
        this.pieces = {};  // e.g., {'a1': pieceDomElem}
        
        this.isReversed = false;
        
        // Input state
        this.inputEnabledColor = null; 
        this.onMoveCallback = null;
        this.draggedPiece = null;
        this.sourceSquare = null;
        this.selectedSquare = null;
        
        this.gameRef = null; // Used for move validation during drag

        this._initBoard();
    }

    _initBoard() {
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

        for (let r = 0; r < 8; r++) {
            for (let f = 0; f < 8; f++) {
                const squareId = files[f] + ranks[r];
                const isLight = (r + f) % 2 === 0;

                const sqEl = document.createElement('div');
                sqEl.className = `square ${isLight ? 'light' : 'dark'}`;
                sqEl.dataset.square = squareId;

                // Add notation
                if (f === 0) {
                    const notNum = document.createElement('div');
                    notNum.className = 'notation-num';
                    notNum.innerText = ranks[r];
                    sqEl.appendChild(notNum);
                }
                if (r === 7) {
                    const notAlpha = document.createElement('div');
                    notAlpha.className = 'notation-alpha';
                    notAlpha.innerText = files[f];
                    sqEl.appendChild(notAlpha);
                }

                // Setup drag/drop/click event listeners
                sqEl.addEventListener('dragover', this._handleDragOver.bind(this));
                sqEl.addEventListener('drop', this._handleDrop.bind(this));
                sqEl.addEventListener('click', () => this._handleSquareClick(squareId));

                this.boardEl.appendChild(sqEl);
                this.squares[squareId] = sqEl;
            }
        }
    }

    updateBoard(game) {
        this.gameRef = game;
        // Clear all pieces
        for (let sq in this.squares) {
            const piece = this.squares[sq].querySelector('.piece');
            if (piece) {
                this.squares[sq].removeChild(piece);
            }
            this.squares[sq].classList.remove('highlight-last', 'highlight-valid', 'highlight-capture');
        }

        const history = game.history({ verbose: true });
        if (history.length > 0) {
            const lastMove = history[history.length - 1];
            this.squares[lastMove.from]?.classList.add('highlight-last');
            this.squares[lastMove.to]?.classList.add('highlight-last');
        }

        // Render current state
        const board = game.board(); // 2D array
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

        for (let r = 0; r < 8; r++) {
            for (let f = 0; f < 8; f++) {
                const squareId = files[f] + ranks[r];
                const pieceData = board[r][f];
                if (pieceData) {
                    const pEl = document.createElement('div');
                    pEl.className = `piece ${pieceData.color}${pieceData.type.toUpperCase()}`;
                    pEl.dataset.pieceColor = pieceData.color;
                    pEl.dataset.square = squareId;
                    pEl.draggable = true;

                    // Drag Events
                    pEl.addEventListener('dragstart', this._handleDragStart.bind(this));
                    pEl.addEventListener('dragend', this._handleDragEnd.bind(this));

                    this.squares[squareId].appendChild(pEl);
                }
            }
        }
    }

    animateMove(move) {
        // Here we could add CSS transitions if desired
        // For simplicity, updateBoard takes care of exact positioning instantly
    }

    enableInput(color, callback) {
        this.inputEnabledColor = color;
        this.onMoveCallback = callback;
    }

    disableInput() {
        this.inputEnabledColor = null;
        this.onMoveCallback = null;
        this._clearHighlights();
    }

    _handleDragStart(e) {
        const pieceColor = e.target.dataset.pieceColor;
        if (!this.inputEnabledColor || pieceColor !== this.inputEnabledColor) {
            e.preventDefault();
            return;
        }

        this.draggedPiece = e.target;
        this.sourceSquare = e.target.dataset.square;
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => e.target.classList.add('dragging'), 0);

        this._highlightValidMoves(this.sourceSquare);
    }

    _handleDragEnd(e) {
        if(this.draggedPiece) {
            this.draggedPiece.classList.remove('dragging');
        }
        this.draggedPiece = null;
        this.sourceSquare = null;
        this._clearHighlights();
    }

    _handleDragOver(e) {
        if(this.draggedPiece) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        }
    }

    _handleDrop(e) {
        e.preventDefault();
        if (!this.draggedPiece || !this.onMoveCallback || !this.gameRef) return;

        let targetSquareEl = e.target;
        if (targetSquareEl.classList.contains('piece')) {
            targetSquareEl = targetSquareEl.parentElement;
        }
        
        const targetSquare = targetSquareEl.dataset.square;

        // Verify move legality via chess.js instance
        const moves = this.gameRef.moves({ square: this.sourceSquare, verbose: true });
        const validMove = moves.find(m => m.to === targetSquare);

        if (validMove) {
            // Check for promotion (default to queen for simple UI, or bring out a prompt)
            let moveObj = { from: this.sourceSquare, to: targetSquare };
            if (validMove.promotion) moveObj.promotion = 'q'; // Default to queen
            
            // Execute callback
            this.onMoveCallback(moveObj);
        } else {
            this.updateBoard(this.gameRef);
        }
    }

    _handleSquareClick(squareId) {
        if (!this.inputEnabledColor || !this.onMoveCallback || !this.gameRef) return;

        if (this.selectedSquare && this.selectedSquare !== squareId) {
            const moves = this.gameRef.moves({ square: this.selectedSquare, verbose: true });
            const validMove = moves.find(m => m.to === squareId);
            
            if (validMove) {
                let moveObj = { from: this.selectedSquare, to: squareId };
                if (validMove.promotion) moveObj.promotion = 'q';
                
                this.selectedSquare = null;
                this._clearHighlights();
                this.onMoveCallback(moveObj);
                return;
            }
        }

        const sqEl = this.squares[squareId];
        const piece = sqEl.querySelector('.piece');
        
        if (piece && piece.dataset.pieceColor === this.inputEnabledColor) {
            this.selectedSquare = squareId;
            this._clearHighlights();
            sqEl.classList.add('highlight-capture'); // Highlight selected piece
            this._highlightValidMoves(squareId);
        } else if (this.selectedSquare) {
            this.selectedSquare = null;
            this._clearHighlights();
            this.updateBoard(this.gameRef); // Snap back last moves
        }
    }

    _highlightValidMoves(sq) {
        if (!this.gameRef) return;
        const moves = this.gameRef.moves({ square: sq, verbose: true });
        moves.forEach(m => {
            const el = this.squares[m.to];
            if(el) {
                if (m.captured) el.classList.add('highlight-capture');
                else el.classList.add('highlight-valid');
            }
        });
    }

    _clearHighlights() {
        for (let sq in this.squares) {
            this.squares[sq].classList.remove('highlight-valid', 'highlight-capture');
        }
    }
}
