/**
 * TournamentModal — UI for configuring and viewing tournament results
 *
 * Shows a full-screen modal with:
 *   - Engine selection checkboxes
 *   - Games-per-match slider
 *   - Start/Stop buttons
 *   - Progress bar
 *   - Results table with ELO ratings
 *   - Per-matchup W/D/L breakdown
 */
class TournamentModal {
    constructor(engineFactories) {
        this.engineFactories = engineFactories; // { name, factory }[]
        this.tournament = new Tournament();
        this._buildModal();
        this._bindEvents();
    }

    /* ============================================================== */
    /*  Build the modal DOM                                           */
    /* ============================================================== */
    _buildModal() {
        this.overlay = document.createElement('div');
        this.overlay.id = 'tournament-overlay';
        this.overlay.className = 'tournament-overlay';
        this.overlay.innerHTML = `
            <div class="tournament-modal">
                <div class="tournament-header">
                    <h2><i class="fa-solid fa-trophy"></i> Engine Tournament</h2>
                    <button class="btn secondary tournament-close" id="tournament-close">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div class="tournament-body">
                    <!-- Config Section -->
                    <div class="tournament-config" id="tournament-config">
                        <div class="config-section">
                            <h3>Select Engines</h3>
                            <div class="engine-checkboxes" id="engine-checkboxes">
                                ${this.engineFactories.map((e, i) => `
                                    <label class="engine-checkbox">
                                        <input type="checkbox" value="${i}" checked>
                                        <span>${e.name}</span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>

                        <div class="config-section">
                            <h3>Games per matchup</h3>
                            <div class="games-slider-row">
                                <input type="range" id="games-per-match" min="2" max="30" value="10" step="2">
                                <span id="games-count-label">10</span>
                            </div>
                        </div>

                        <div class="tournament-note">
                            <i class="fa-solid fa-circle-info"></i>
                            Colors alternate each game for fairness. Engines run at tournament speed
                            (no delays, shorter time limits). Stockfish engines run at fixed depth.
                        </div>

                        <button class="btn primary tournament-start" id="tournament-start">
                            <i class="fa-solid fa-play"></i> Start Tournament
                        </button>
                    </div>

                    <!-- Progress Section -->
                    <div class="tournament-progress hidden" id="tournament-progress">
                        <div class="progress-bar-container">
                            <div class="progress-bar-fill" id="progress-fill"></div>
                        </div>
                        <div class="progress-text" id="progress-text">Initializing...</div>
                        <div class="progress-detail" id="progress-detail"></div>
                        <button class="btn danger" id="tournament-abort">
                            <i class="fa-solid fa-stop"></i> Abort
                        </button>
                    </div>

                    <!-- Results Section -->
                    <div class="tournament-results hidden" id="tournament-results">
                        <h3><i class="fa-solid fa-ranking-star"></i> ELO Ratings</h3>
                        <table class="results-table" id="results-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Engine</th>
                                    <th>ELO</th>
                                    <th>Score</th>
                                </tr>
                            </thead>
                            <tbody id="results-body"></tbody>
                        </table>

                        <h3 style="margin-top: 1rem;"><i class="fa-solid fa-table"></i> Head-to-Head</h3>
                        <div class="h2h-container" id="h2h-container"></div>

                        <div class="tournament-actions">
                            <button class="btn secondary" id="tournament-rerun">
                                <i class="fa-solid fa-rotate"></i> New Tournament
                            </button>
                            <button class="btn secondary" id="tournament-copy">
                                <i class="fa-solid fa-copy"></i> Copy Results
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(this.overlay);
    }

    /* ============================================================== */
    /*  Bind events                                                   */
    /* ============================================================== */
    _bindEvents() {
        document.getElementById('tournament-close').addEventListener('click', () => this.hide());
        document.getElementById('tournament-start').addEventListener('click', () => this._startTournament());
        document.getElementById('tournament-abort').addEventListener('click', () => this._abort());
        document.getElementById('tournament-rerun').addEventListener('click', () => this._showConfig());
        document.getElementById('tournament-copy').addEventListener('click', () => this._copyResults());

        const slider = document.getElementById('games-per-match');
        slider.addEventListener('input', () => {
            document.getElementById('games-count-label').textContent = slider.value;
        });

        // Close on overlay click
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.hide();
        });

        // Close on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.overlay.style.display !== 'none') {
                this.hide();
            }
        });
    }

    /* ============================================================== */
    /*  Show / Hide                                                   */
    /* ============================================================== */
    show() {
        this.overlay.style.display = 'flex';
        this._showConfig();
    }

    hide() {
        if (this.tournament.isRunning) {
            this.tournament.abort();
        }
        this.overlay.style.display = 'none';
    }

    _showConfig() {
        document.getElementById('tournament-config').classList.remove('hidden');
        document.getElementById('tournament-progress').classList.add('hidden');
        document.getElementById('tournament-results').classList.add('hidden');
    }

    /* ============================================================== */
    /*  Start Tournament                                              */
    /* ============================================================== */
    async _startTournament() {
        // Gather selected engines
        const checkboxes = document.querySelectorAll('#engine-checkboxes input:checked');
        const selected = [];
        checkboxes.forEach(cb => {
            const idx = parseInt(cb.value, 10);
            selected.push(this.engineFactories[idx]);
        });

        if (selected.length < 2) {
            alert('Select at least 2 engines!');
            return;
        }

        const gamesPerMatch = parseInt(document.getElementById('games-per-match').value, 10);

        // Show progress
        document.getElementById('tournament-config').classList.add('hidden');
        document.getElementById('tournament-progress').classList.remove('hidden');
        document.getElementById('tournament-results').classList.add('hidden');

        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        const progressDetail = document.getElementById('progress-detail');

        const totalPairs = (selected.length * (selected.length - 1)) / 2;
        let gamesPlayed = 0;
        const totalGames = totalPairs * gamesPerMatch;

        this.tournament.onProgress = (pairsDone, total, detail) => {
            progressText.textContent = detail;
        };

        this.tournament.onGameEnd = (gameNum, result, detail) => {
            gamesPlayed++;
            const pct = Math.round((gamesPlayed / totalGames) * 100);
            progressFill.style.width = `${pct}%`;
            progressDetail.textContent = `Game ${gamesPlayed}/${totalGames}: ${detail} → ${result}`;
        };

        this.tournament.onComplete = (results) => {
            this._showResults(results, selected);
        };

        progressFill.style.width = '0%';
        progressText.textContent = 'Starting tournament...';

        await this.tournament.runRoundRobin(selected, gamesPerMatch);
    }

    _abort() {
        this.tournament.abort();
        this._showConfig();
    }

    /* ============================================================== */
    /*  Display Results                                               */
    /* ============================================================== */
    _showResults(results, engines) {
        document.getElementById('tournament-progress').classList.add('hidden');
        document.getElementById('tournament-results').classList.remove('hidden');

        // ELO table
        const tbody = document.getElementById('results-body');
        tbody.innerHTML = '';

        this._lastResults = results;

        results.forEach((r, i) => {
            // Calculate total score
            let totalWins = 0, totalDraws = 0, totalLosses = 0;
            for (const opp in r.results) {
                const parts = r.results[opp].match(/\+(\d+) =(\d+) -(\d+)/);
                if (parts) {
                    totalWins   += parseInt(parts[1], 10);
                    totalDraws  += parseInt(parts[2], 10);
                    totalLosses += parseInt(parts[3], 10);
                }
            }
            const totalGames = totalWins + totalDraws + totalLosses;
            const score = totalWins + totalDraws * 0.5;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="rank-cell">${i + 1}</td>
                <td class="engine-name-cell">${r.name}</td>
                <td class="elo-cell">${r.elo}</td>
                <td class="score-cell">${score}/${totalGames}</td>
            `;

            // Color code by rank
            if (i === 0) tr.classList.add('rank-gold');
            else if (i === 1) tr.classList.add('rank-silver');
            else if (i === 2) tr.classList.add('rank-bronze');

            tbody.appendChild(tr);
        });

        // Head-to-head table
        const h2hContainer = document.getElementById('h2h-container');
        const names = results.map(r => r.name);

        let h2hHtml = '<table class="h2h-table"><thead><tr><th></th>';
        names.forEach(n => h2hHtml += `<th>${n.replace('Stockfish', 'SF')}</th>`);
        h2hHtml += '</tr></thead><tbody>';

        names.forEach(name => {
            const r = results.find(x => x.name === name);
            h2hHtml += `<tr><td class="h2h-name">${name.replace('Stockfish', 'SF')}</td>`;
            names.forEach(opp => {
                if (name === opp) {
                    h2hHtml += '<td class="h2h-self">—</td>';
                } else {
                    const score = r.results[opp] || '?';
                    h2hHtml += `<td class="h2h-score">${score}</td>`;
                }
            });
            h2hHtml += '</tr>';
        });

        h2hHtml += '</tbody></table>';
        h2hContainer.innerHTML = h2hHtml;
    }

    _copyResults() {
        if (!this._lastResults) return;

        let text = 'Engine Tournament Results\n';
        text += '========================\n\n';
        text += 'Rank  Engine                    ELO\n';
        text += '----  ----------------------  -----\n';

        this._lastResults.forEach((r, i) => {
            text += `${(i + 1).toString().padEnd(6)}${r.name.padEnd(24)}${r.elo}\n`;
        });

        text += '\nHead-to-Head (W/D/L from row player perspective):\n';
        for (const r of this._lastResults) {
            for (const opp in r.results) {
                text += `  ${r.name} vs ${opp}: ${r.results[opp]}\n`;
            }
        }

        navigator.clipboard.writeText(text).then(() => {
            const btn = document.getElementById('tournament-copy');
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
            setTimeout(() => {
                btn.innerHTML = '<i class="fa-solid fa-copy"></i> Copy Results';
            }, 2000);
        });
    }
}
