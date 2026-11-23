export function mountGameUi() {
  
    const ui = document.createElement('div');

    ui.id = 'game-ui';

    ui.innerHTML = `
  <section id="lobby" class="position-absolute top-0 start-0 w-100 h-100 overflow-auto py-4 px-2 bg-info-subtle bg-gradient">
  <div class="bubbles" aria-hidden="true">
  <span></span><span></span><span></span><span></span><span></span><span></span>
  </div>
  <div class="container" style="max-width: 760px">
    <div class="card lobby-card border-0 rounded-5 shadow-lg overflow-hidden">

      <!-- Header -->
      <div class="text-center py-4 px-3 border-bottom border-4 border-warning lobby-header">
        <img src="/traffic-cone.png" alt="" class="cone-logo-img cone-bounce d-block mx-auto mb-2">
        <h1 class="display-4 fw-bolder text-uppercase mb-1 title-cute">
          <span class="title-cone">Cone</span> <span class="title-clash">Clash</span>
        </h1>
        <p class="text-body-secondary fw-medium mb-0">Cone it, Phloem, cone it!</p>
      </div>

      <div class="card-body p-4">

        <form id="create-room-form" class="row g-3 align-items-end bg-body-tertiary border border-2 rounded-4 p-3 mb-3">
          <div class="col-12 col-md-6">
  <label class="form-label fw-bold small text-uppercase text-body-secondary" for="room-name">Room name</label>
  <input id="room-name" name="roomName" class="form-control form-control-lg rounded-pill border-2"
         maxlength="24" placeholder="Rubylin's Game" required>
</div>
<div class="col-12 col-md-6">
  <label class="form-label fw-bold small text-uppercase text-body-secondary" for="create-player-name">Username</label>
  <input id="create-player-name" name="playerName" class="form-control form-control-lg rounded-pill border-2"
         maxlength="16" placeholder="Your name" required>
          </div>
          <div class="col-12">
          <div class="form-label fw-bold small text-uppercase text-body-secondary">Color</div>
          <div id="create-color-picker"></div>
          </div>
          <div class="col-12">
            <label class="form-label fw-bold small text-uppercase text-body-secondary" for="create-player-avatar">Avatar (optional)</label>
            <input id="create-player-avatar" name="avatar" type="file" accept="image/*"
                   class="form-control rounded-pill border-2">
          </div>
          <div class="col-12">
            <button type="submit" class="btn btn-warning btn-lg fw-bold w-100 rounded-pill text-uppercase btn-pop">
              Create room
            </button>
          </div>
        </form>

        <div id="lobby-message" class="small mb-3" role="status" aria-live="polite"></div>

        <h2 class="h6 fw-bold text-uppercase text-success-emphasis d-flex align-items-center gap-2">
          <span class="section-dot bg-success"></span> Available rooms
        </h2>
        <div id="room-list" class="mb-4"></div>

        <h2 class="h6 fw-bold text-uppercase text-primary-emphasis d-flex align-items-center gap-2">
        <span class="section-dot bg-primary"></span> Match history
        </h2>
        <div id="match-history" class="d-grid gap-2"></div>
      </div>
    </div>
  </div>
</section>

  <div id="game-hud" class="hidden">
    <div id="timer" class="position-absolute top-0 start-50 translate-middle-x mt-3 px-4 py-2 display-5 fw-bolder bg-body border border-3 rounded-4">45</div>
    <div id="match-status" class="badge text-bg-dark position-absolute start-50 translate-middle-x" style="top: 105px">ROUND 1 · REAL-TIME</div>
    <div id="countdown" class="position-absolute start-50 translate-middle text-center display-1 fw-bolder px-5 py-2 rounded-5 border border-4 border-white shadow-lg bg-warning text-dark">GET READY!</div>
    <div id="scores" class="position-absolute top-0 start-0 m-3 p-3 rounded-3 bg-dark bg-opacity-75 fw-bold"></div>

    <div id="instructions" class="position-absolute bottom-0 start-50 translate-middle-x mb-3 px-3 py-2 rounded-3 bg-dark bg-opacity-75 small d-flex align-items-center gap-3">
      <span id="controls-text">P1: WASD + E | P2: ARROWS + ENTER | P3: IJKL + O</span>
      <button id="leave-match" type="button" class="btn btn-sm btn-outline-warning">LEAVE MATCH</button>
    </div>
  </div>

      <div id="podium" class="hidden position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3 bg-black bg-opacity-75 podium-backdrop">
    <div class="container" style="max-width: 640px">
      <div class="card lobby-card podium-card border-0 rounded-5 shadow-lg overflow-hidden">

        <div class="text-center py-4 px-3 border-bottom border-4 border-warning lobby-header">
          <div id="podium-trophy" class="display-3 d-inline-block cone-bounce">🏆</div>
          <h1 class="podium-title title-cute display-6 fw-bolder text-uppercase text-white mb-1"></h1>
          <p id="podium-subtitle" class="text-body-secondary fw-medium mb-0"></p>
        </div>

        <div class="card-body px-4 pt-4 pb-2">
          <div id="podium-content" class="row g-2 justify-content-center align-items-end text-center" style="height: 280px"></div>
        </div>

        <div class="p-4 pt-2">
          <button id="restart" type="button" class="btn btn-warning btn-lg fw-bold w-100 rounded-pill text-uppercase btn-pop">
            BACK TO LOBBY
          </button>
        </div>
      </div>
    </div>
  </div>

  <section id="ready-screen" class="hidden position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3 bg-black bg-opacity-50">
  <div class="card border-0 rounded-5 shadow-lg overflow-hidden w-100" style="max-width: 640px">
    <div class="text-center py-3 px-3 border-bottom border-4 border-warning lobby-header">
      <h2 class="fs-2 fw-bolder text-uppercase mb-0 title-cute">
        <span class="title-cone">How to</span> <span class="title-clash">play</span>
      </h2>
    </div>
    <div class="card-body p-4">
      <ul class="small ps-3 mb-3">
        <li>When the countdown hits <strong>GO</strong>, dash from your base to the center and grab a cone with your action key.</li>
        <li>Carry <strong>one cone at a time</strong> back to your own base and press your action key to drop it off.</li>
        <li>Stand at a rival's base and press your action key to <strong>steal</strong> one of their cones, and protect yours.</li>
        <li>Get 3 cones into your base, or have the most when time runs out, to win the round. First to 2 round wins takes the match.</li>
      </ul>

      <h3 class="h6 fw-bold text-uppercase text-body-secondary">Your capsules and controls</h3>
      <div id="ready-players" class="mb-2"></div>

      <div id="ready-status" class="text-center small fw-semibold text-body-secondary mb-3" role="status" aria-live="polite"></div>
      <button id="ready-leave" type="button" class="btn btn-link text-body-secondary w-100">Leave match</button>
    </div>
  </div>
</section>

  <div id="app-message" class="alert alert-danger position-absolute top-0 start-50 translate-middle-x mt-3 d-none" role="alert" aria-live="assertive"></div>
`;

document.body.appendChild(ui);
}