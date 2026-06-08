const STORAGE_KEY = "bbong-score-web-v1";

const state = {
  roundCount: 10,
  playerCount: 4,
  penalties: [],
  players: [],
  rounds: [],
  gameEnded: false
};

const $ = (id) => document.getElementById(id);

const screens = {
  setup: $("setupScreen"),
  name: $("nameScreen"),
  game: $("gameScreen")
};

function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.remove("active"));
  screens[name].classList.add("active");
  $("resetAllBtn").classList.toggle("hidden", name !== "game");
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return false;
  try {
    const parsed = JSON.parse(saved);
    Object.assign(state, parsed);
    state.gameEnded = Boolean(state.gameEnded);
    return state.players.length > 0;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return false;
  }
}

function formatMoney(value) {
  const number = Number(value || 0);
  return `${number.toLocaleString("ko-KR")}원`;
}

function getRoundLabel(index) {
  const labels = [
    "첫 번째", "두 번째", "세 번째", "네 번째", "다섯 번째",
    "여섯 번째", "일곱 번째", "여덟 번째", "아홉 번째", "열 번째",
    "열한 번째", "열두 번째", "열세 번째", "열네 번째", "열다섯 번째",
    "열여섯 번째", "열일곱 번째", "열여덟 번째", "열아홉 번째", "스무 번째"
  ];
  return labels[index] || `${index + 1}번째`;
}

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.remove("hidden");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.add("hidden"), 1600);
}

function openModal(id) {
  $(id).classList.remove("hidden");
}

function closeModal(id) {
  $(id).classList.add("hidden");
}

function getFinishedRoundCount() {
  return Math.min(state.rounds.length, state.roundCount);
}

function shouldEndGame() {
  return state.rounds.length >= state.roundCount && !hasAnyTotalTie();
}

function renderFinalResultList() {
  const box = $("finalResultList");
  if (!box) return;

  const rankedPlayers = getRankedPlayers();
  if (rankedPlayers.length === 0) {
    box.innerHTML = `<p class="hint">표시할 최종 결과가 없습니다.</p>`;
    return;
  }

  box.innerHTML = rankedPlayers.map((player) => {
    const medal = getRankMedal(player.rank);
    const rankClass = getRankClass(player.rank);
    return `
      <div class="finalResultItem ${rankClass}">
        <div class="finalResultRank">${medal}${player.rank}등</div>
        <div class="finalResultMain">
          <strong>${player.name}</strong>
          <span>${player.total}점</span>
        </div>
        <div class="finalResultPenalty">${formatMoney(player.penalty)}</div>
      </div>
    `;
  }).join("");
}


function buildFinalResultText() {
  const rankedPlayers = getRankedPlayers();
  if (rankedPlayers.length === 0) {
    return "뻥 게임 최종 결과가 없습니다.";
  }

  const lines = ["🏆 뻥 게임 최종 결과", ""];
  rankedPlayers.forEach((player) => {
    const medal = getRankMedal(player.rank).trim();
    const rankLabel = `${medal ? medal + " " : ""}${player.rank}등`;
    lines.push(`${rankLabel} ${player.name} - ${player.total}점 / ${formatMoney(player.penalty)}`);
  });

  return lines.join("\n");
}

async function shareFinalResult() {
  const text = buildFinalResultText();
  const shareData = {
    title: "뻥 게임 최종 결과",
    text
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
      return;
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      toast("공유 기능이 없어 결과를 복사했어요");
      return;
    }

    window.prompt("결과를 복사해서 공유해주세요", text);
  } catch (error) {
    if (error?.name === "AbortError") return;
    toast("공유를 완료하지 못했어요");
  }
}

function showGameEndModalIfNeeded() {
  if (!shouldEndGame() || state.gameEnded) return;
  state.gameEnded = true;
  renderFinalResultList();
  saveState();
  openModal("gameEndModal");
}

function syncNextGameForm() {
  const keepRound = $("keepRoundCheck").checked;
  const keepNames = $("keepNamesCheck").checked;

  $("nextRoundCount").disabled = keepRound;
  $("nextNameInputs").classList.toggle("dimmed", keepNames);
  [...document.querySelectorAll(".nextNameInput")].forEach((input) => {
    input.disabled = keepNames;
  });
}

function renderNextGameForm() {
  $("nextRoundCount").value = state.roundCount;
  const box = $("nextNameInputs");
  box.innerHTML = "";

  state.players.forEach((player, index) => {
    const label = document.createElement("label");
    label.className = "field compactField";
    label.innerHTML = `
      <span>${index + 1}번 팀 / 플레이어</span>
      <input class="nextNameInput" type="text" value="${player.name}" maxlength="12" />
    `;
    box.appendChild(label);
  });

  syncNextGameForm();
}

function startNextGame() {
  const keepRound = $("keepRoundCheck").checked;
  const keepNames = $("keepNamesCheck").checked;
  const nextRoundCount = keepRound ? state.roundCount : Number($("nextRoundCount").value || 1);

  if (nextRoundCount < 1) {
    toast("진행 판수는 1판 이상이어야 해요");
    return;
  }

  if (!keepNames) {
    const names = [...document.querySelectorAll(".nextNameInput")].map((input, index) => input.value.trim() || `${index + 1}팀`);
    state.players = names.map((name) => ({ name }));
  }

  state.roundCount = nextRoundCount;
  state.rounds = [];
  state.gameEnded = false;
  closeModal("nextGameModal");
  closeModal("gameEndModal");
  renderGame();
  showScreen("game");
  toast("다음 경기를 시작했어요");
}

function renderPenaltyInputs() {
  const count = Number($("playerCount").value);
  const box = $("penaltyInputs");
  box.innerHTML = "";

  for (let i = 1; i <= count; i++) {
    const label = document.createElement("label");
    label.className = "field";
    label.innerHTML = `
      <span>${i}등 벌금</span>
      <input class="penaltyInput" type="number" min="0" step="1000" value="${state.penalties[i - 1] ?? (i === 1 ? 0 : i * 1000)}" inputmode="numeric" />
    `;
    box.appendChild(label);
  }
}

function renderNameInputs() {
  const box = $("nameInputs");
  box.innerHTML = "";

  for (let i = 0; i < state.playerCount; i++) {
    const label = document.createElement("label");
    label.className = "field";
    label.innerHTML = `
      <span>${i + 1}번 팀 / 플레이어</span>
      <input class="nameInput" type="text" value="${state.players[i]?.name || `${i + 1}팀`}" maxlength="12" />
    `;
    box.appendChild(label);
  }
}

function getTotals() {
  return state.players.map((player, playerIndex) => {
    const total = state.rounds.reduce((sum, round) => sum + Number(round[playerIndex] || 0), 0);
    return { ...player, playerIndex, total };
  });
}

function getRankedPlayers() {
  const sorted = getTotals().sort((a, b) => {
    if (a.total !== b.total) return a.total - b.total;
    return a.playerIndex - b.playerIndex;
  });

  let previousTotal = null;
  let currentRank = 0;

  return sorted.map((player) => {
    if (previousTotal === null || player.total !== previousTotal) {
      currentRank += 1;
      previousTotal = player.total;
    }

    return {
      ...player,
      rank: currentRank,
      penalty: state.penalties[currentRank - 1] || 0
    };
  });
}

function hasAnyTotalTie() {
  const seen = new Set();

  for (const player of getTotals()) {
    if (seen.has(player.total)) return true;
    seen.add(player.total);
  }

  return false;
}

function extendFinalRoundIfNeeded() {
  if (state.rounds.length === 0) return false;
  if (state.rounds.length !== state.roundCount) return false;
  if (!hasAnyTotalTie()) return false;

  state.roundCount += 1;
  return true;
}


function getRankMedal(rank) {
  if (rank === 1) return "🥇 ";
  if (rank === 2) return "🥈 ";
  if (rank === 3) return "🥉 ";
  return "";
}

function getRankClass(rank) {
  if (rank === 1) return "rank1";
  if (rank === 2) return "rank2";
  if (rank === 3) return "rank3";
  return "rankOther";
}

function renderScoreInputs() {
  const box = $("scoreInputs");
  box.innerHTML = "";

  state.players.forEach((player, index) => {
    const label = document.createElement("label");
    label.className = "field";
    label.innerHTML = `
      <span>${player.name}</span>
      <input class="scoreInput" data-index="${index}" type="number" value="" placeholder="점수" inputmode="numeric" />
    `;
    box.appendChild(label);
  });
}

function renderGame() {
  $("currentRoundText").textContent = Math.min(state.rounds.length + 1, state.roundCount);
  $("totalRoundText").textContent = state.roundCount;
  $("saveRoundBtn").textContent = state.rounds.length >= state.roundCount ? "최종 완료" : "점수 저장";

  renderScoreInputs();
  renderScoreBoard();
  renderHistory();
  saveState();
}

function renderScoreBoard() {
  const box = $("scoreBoard");
  if (!box) return;

  const totals = getTotals();
  const hasAnyRound = state.rounds.length > 0;
  const rankedByIndex = new Map(getRankedPlayers().map((player) => [player.playerIndex, player]));
  const columnGroup = `
    <colgroup>
      <col class="roundColumn" />
      ${state.players.map(() => `<col class="playerColumn" />`).join("")}
    </colgroup>
  `;
  const headCells = state.players.map((player) => `<th>${player.name}</th>`).join("");
  const totalCells = totals.map((player) => `<td class="totalScoreCell">${player.total}점</td>`).join("");
  const rankCells = totals.map((player) => {
    if (!hasAnyRound) {
      return `<td class="rankTopCell emptyRank">-</td>`;
    }

    const ranked = rankedByIndex.get(player.playerIndex);
    const medal = getRankMedal(ranked.rank);
    const rankClass = getRankClass(ranked.rank);
    return `
      <td class="rankTopCell ${rankClass}">
        <span class="rankText">${medal}${ranked.rank}등</span>
        <span class="penaltyText">${formatMoney(ranked.penalty)}</span>
      </td>
    `;
  }).join("");

  let rows = `
    <table class="rankTopTable">
      ${columnGroup}
      <tbody>
        <tr>
          <th class="rankTopLabel">순위</th>
          ${rankCells}
        </tr>
      </tbody>
    </table>
    <table class="scoreBoard">
      ${columnGroup}
      <thead>
        <tr>
          <th class="roundCell">판수</th>
          ${headCells}
        </tr>
      </thead>
      <tbody>
        <tr class="totalRow">
          <th class="roundCell">총 점수</th>
          ${totalCells}
        </tr>
  `;

  if (state.rounds.length === 0) {
    rows += `<tr><td colspan="${state.players.length + 1}" class="hint emptyBoardMessage">아직 저장된 판이 없습니다.</td></tr>`;
  } else {
    state.rounds.forEach((round, roundIndex) => {
      const scoreCells = state.players.map((_, playerIndex) => `<td>${Number(round[playerIndex] || 0)}점</td>`).join("");
      rows += `
        <tr>
          <th class="roundCell">${getRoundLabel(roundIndex)}</th>
          ${scoreCells}
        </tr>
      `;
    });
  }

  rows += `</tbody></table>`;
  box.innerHTML = rows;
}

function renderHistory() {
  const box = $("roundHistory");
  box.innerHTML = "";

  if (state.rounds.length === 0) {
    box.innerHTML = `<p class="hint">아직 저장된 판이 없습니다.</p>`;
    return;
  }

  state.rounds.forEach((round, roundIndex) => {
    const item = document.createElement("div");
    item.className = "historyItem";

    const rows = state.players.map((player, playerIndex) => `
      <label class="historyRow">
        <span>${player.name}</span>
        <input class="historyInput" data-round="${roundIndex}" data-player="${playerIndex}" type="number" value="${round[playerIndex] || 0}" inputmode="numeric" />
      </label>
    `).join("");

    item.innerHTML = `
      <div class="historyHeader">
        <span>${getRoundLabel(roundIndex)} 기록</span>
        <button class="ghost saveEditBtn" data-round="${roundIndex}" type="button">수정 저장</button>
      </div>
      <div class="historyBody">${rows}</div>
    `;
    box.appendChild(item);
  });
}

function collectSetup() {
  state.roundCount = Number($("roundCount").value || 1);
  state.playerCount = Number($("playerCount").value || 3);
  state.penalties = [...document.querySelectorAll(".penaltyInput")].map((input) => Number(input.value || 0));

  if (state.roundCount < 1) {
    toast("진행 판수는 1판 이상이어야 해요");
    return false;
  }
  return true;
}

document.querySelectorAll(".stepBtn").forEach((button) => {
  button.addEventListener("click", () => {
    const input = $(button.dataset.target);
    const min = Number(input.min || 0);
    const max = Number(input.max || 999);
    const step = Number(button.dataset.step || 1);
    const next = Math.min(max, Math.max(min, Number(input.value || min) + step));
    input.value = next;

    if (input.id === "playerCount") {
      renderPenaltyInputs();
    }
  });
});

$("roundCount").addEventListener("change", () => {
  const input = $("roundCount");
  input.value = Math.min(Number(input.max), Math.max(Number(input.min), Number(input.value || input.min)));
});

$("toNameBtn").addEventListener("click", () => {
  if (!collectSetup()) return;
  state.players = Array.from({ length: state.playerCount }, (_, i) => state.players[i] || { name: `${i + 1}팀` });
  renderNameInputs();
  showScreen("name");
});

$("backToSetupBtn").addEventListener("click", () => showScreen("setup"));

$("startGameBtn").addEventListener("click", () => {
  const names = [...document.querySelectorAll(".nameInput")].map((input, index) => input.value.trim() || `${index + 1}팀`);
  state.players = names.map((name) => ({ name }));
  state.rounds = [];
  state.gameEnded = false;
  renderGame();
  showScreen("game");
});

$("saveRoundBtn").addEventListener("click", () => {
  if (state.rounds.length >= state.roundCount) {
    if (shouldEndGame()) {
      renderFinalResultList();
      state.gameEnded = true;
      saveState();
      openModal("gameEndModal");
      return;
    }

    toast("이미 마지막 판까지 입력했어요");
    return;
  }

  const scores = [...document.querySelectorAll(".scoreInput")].map((input) => Number(input.value || 0));
  state.rounds.push(scores);
  state.gameEnded = false;
  const extended = extendFinalRoundIfNeeded();
  renderGame();
  toast(extended
    ? `동점이 있어 ${getRoundLabel(state.roundCount - 1)} 판이 자동 추가됐어요`
    : `${getRoundLabel(state.rounds.length - 1)} 기록 저장 완료`
  );
  showGameEndModalIfNeeded();
});

$("roundHistory").addEventListener("click", (event) => {
  if (!event.target.classList.contains("saveEditBtn")) return;
  const roundIndex = Number(event.target.dataset.round);
  const inputs = [...document.querySelectorAll(`.historyInput[data-round="${roundIndex}"]`)];
  inputs.forEach((input) => {
    state.rounds[roundIndex][Number(input.dataset.player)] = Number(input.value || 0);
  });
  state.gameEnded = false;
  const extended = extendFinalRoundIfNeeded();
  renderGame();
  toast(extended
    ? `동점이 있어 ${getRoundLabel(state.roundCount - 1)} 판이 자동 추가됐어요`
    : `${getRoundLabel(roundIndex)} 기록 수정 완료`
  );
  showGameEndModalIfNeeded();
});

$("shareResultBtn").addEventListener("click", shareFinalResult);

$("finishGameBtn").addEventListener("click", () => {
  closeModal("gameEndModal");
  toast("최종 결과를 확인해주세요");
});

$("nextGameBtn").addEventListener("click", () => {
  renderNextGameForm();
  closeModal("gameEndModal");
  openModal("nextGameModal");
});

$("cancelNextGameBtn").addEventListener("click", () => {
  closeModal("nextGameModal");
  renderFinalResultList();
  openModal("gameEndModal");
});

$("confirmNextGameBtn").addEventListener("click", startNextGame);

$("keepRoundCheck").addEventListener("change", syncNextGameForm);
$("keepNamesCheck").addEventListener("change", syncNextGameForm);

$("nextRoundCount").addEventListener("change", () => {
  const input = $("nextRoundCount");
  input.value = Math.min(Number(input.max), Math.max(Number(input.min), Number(input.value || input.min)));
});

$("resetAllBtn").addEventListener("click", () => {
  if (!confirm("현재 게임 기록을 모두 지우고 처음부터 시작할까요?")) return;
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
});

document.addEventListener("focusin", (event) => {
  const input = event.target;

  if (!input.matches(".scoreInput, .historyInput")) return;

  if (input.value === "0") {
    input.value = "";
  }

  setTimeout(() => input.select?.(), 0);
});

function init() {
  if (loadState()) {
    showScreen("game");
    renderGame();
    return;
  }
  renderPenaltyInputs();
  showScreen("setup");
}

init();
