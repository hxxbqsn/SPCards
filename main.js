import { cards } from './cardsData.js';
import { decideAIMove } from './aiLogic.js';
//-----所有状态
const ROWS = ['human', 'elf', 'wizard'];
const state = {
  deck: [],  
  hands: { player: [], ai: [] },
  score: { player: 0, ai: 0 },
  lives: { player: 2, ai: 2 },
  battlefieldData: {
    player: { human: [], elf: [], wizard: [] },
    ai:     { human: [], elf: [], wizard: [] }
  },
  princessDebuff:{
    player:0,//debuff可叠加，初始为0
    ai:0
  },
  healbuff:{
    player:0,
    ai:0
  },
  sparkleCount:{
    player:0,
    ai:0
  },
  trueLoveCount:{
    player:0,
    ai:0
  },
  turnBuffs: {
    player: { bard:false, tokenRows:new Set() },
    ai:     { bard:false, tokenRows:new Set() }
  },
  passed: { player:false, ai:false },
  firstDealDone: false
};
//------DOM
const DOM = {
  playerHand:      document.getElementById('player-hand'),
  aiHand:          document.getElementById('ai-hand'),
  rows: {
    player: {
      human:  document.getElementById('human'),
      elf:    document.getElementById('elf'),
      wizard: document.getElementById('wizard')
    },
    ai: {
      human:  document.getElementById('ai-human'),
      elf:    document.getElementById('ai-elf'),
      wizard: document.getElementById('ai-wizard')
    }
  },
  passBtn:         document.getElementById('player-pass'),
  score: {
    player:        document.getElementById('player-score'),
    ai:            document.getElementById('ai-score')
  },
  lives: {
    player:        document.getElementById('player-lives'),
    ai:            document.getElementById('ai-lives')
  },
  count: {
    player:        document.getElementById('player-hand-count'),
    ai:            document.getElementById('ai-hand-count')
  },
  countWrap: {
    player:        document.getElementById('player-hand-count-container'),
    ai:            document.getElementById('ai-hand-count-container')
  }
};
//-------洗牌
function shuffle(array) {
  const a = array.slice();//避免更改原牌组
  for (let i = 0; i < a.length; i++) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
//-------抽牌
function draw(deck, handSize = 10, maxCopies = 2) {//设置抽十张，每张最多重复2次
  const available = deck.slice();
  const hand = [];
  const count = Object.create(null);
  while (hand.length < handSize && available.length > 0) {
    const idx = Math.floor(Math.random() * available.length);
    const card = JSON.parse(JSON.stringify(available[idx]));
    count[card.id] = (count[card.id] || 0) + 1;
    if (count[card.id] <= maxCopies) {
      hand.push(card);
      if (count[card.id] === maxCopies) {//如果刚好达到限额，
        available.splice(idx, 1);//把这张牌从牌组中剔除避免再抽到
      }
    } else {//超额时（保险）
      count[card.id]--;
      available.splice(idx, 1);
    }
  }
  return { hand, remainingDeck: available };
}
// 创建卡牌 DOM 节点
function createCardElement(card, cssClasses = 'card') {
  const el = document.createElement('div');
  el.className = cssClasses;
  const img = document.createElement('img');
  img.src = card.image;
  img.alt = card.id;
  el.appendChild(img);
  const lbl = document.createElement('div');
  lbl.className = 'card-label';
  lbl.textContent = card.power;
  el.appendChild(lbl);
  el.cardData=card;
  return el;
}

// 绑定拖拽事件
function bindDragEvents(cardEl, idx, type) {
  cardEl.draggable = true;
  cardEl.addEventListener('dragstart', e => {
    e.dataTransfer.setData('application/json', JSON.stringify({ idx, type }));
    cardEl.classList.add('dragging');
    DOM.rows.player[type].classList.add('highlight');
  });
  cardEl.addEventListener('dragend', () => {
    cardEl.classList.remove('dragging');
    document.querySelectorAll('.row.highlight')
      .forEach(r => r.classList.remove('highlight'));
  });
  //右键呼出简介
  cardEl.addEventListener('contextmenu', e => {
    e.preventDefault();
    showCardPopup(cardEl.cardData);
  });
}
//弹出游戏玩法介绍
function showIntro() {
  const overlay = document.getElementById('intro-overlay');
  overlay.style.display = 'flex';
  overlay.style.opacity = '0';  // 重置初始透明

  // 让浏览器下一帧再开始渐变
  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
  });

  function onKeyDown(e) {
    if (e.key === 'Enter') {
      overlay.style.opacity = '0'; // 渐变消失
      document.removeEventListener('keydown', onKeyDown);

      // 等动画结束再隐藏
      setTimeout(() => {
        overlay.style.display = 'none';
      }, 500); // 和 transition 时间一致
    }
  }

  document.addEventListener('keydown', onKeyDown);
}
window.addEventListener('DOMContentLoaded', () => {
  showIntro(); // 页面加载时弹出
});
function showCardPopup(card) {
  const overlay = document.getElementById('card-overlay');
  const img = document.getElementById('popup-card-image');
  const text = document.getElementById('popup-card-text');
  img.src = card.image;
  text.textContent = card.description || '暂无描述';
  overlay.style.display = 'flex';
  // 再次点击关闭
  overlay.onclick = () => {
    overlay.style.display = 'none';
  };
}
// 更新手牌显示，带或不带发牌动画
function renderHands({ withDealAnimation = false } = {}) {
  DOM.playerHand.innerHTML = '';
  state.hands.player.forEach((card, idx) => {
    const css = withDealAnimation ? 'card dealing' : 'card';
    const cardEl = createCardElement(card, css);
    bindDragEvents(cardEl, idx, card.type);
    DOM.playerHand.appendChild(cardEl);

    if (withDealAnimation) {
      cardEl.addEventListener('animationend', () => {
        cardEl.classList.remove('dealing');
      }, { once: true });
    }
  });
  state.firstDealDone = true;
}

// 更新生命
function renderLives() {
  ['player','ai'].forEach(side => {
    DOM.lives[side].textContent = '❤'.repeat(state.lives[side]);
  });
}

// 更新分数
function updateScoreDisplay() {
  DOM.score.player.textContent = state.score.player;
  DOM.score.ai.textContent     = state.score.ai;

  [DOM.score.player, DOM.score.ai].forEach(el => {
    el.classList.add('updated');
    el.addEventListener('animationend', () => el.classList.remove('updated'), { once: true });
  });
}

// 更新手牌数和动画
function updateHandCount() {
  DOM.count.player.textContent = state.hands.player.length;
  DOM.count.ai.textContent     = state.hands.ai.length;
  Object.values(DOM.countWrap).forEach(wrap => {
    wrap.classList.add('updated');
    setTimeout(() => wrap.classList.remove('updated'), 500);
  });
}

// 渲染单张出牌
function placeCardOnBoard(side, card) {
  const rowEl = DOM.rows[side][card.type];
  const el = createCardElement(card, 'card placing');
  rowEl.appendChild(el);
  el.addEventListener('animationend', () => el.classList.remove('placing'), { once: true });
}
function renderDealToHand(side, card) {
  // 选出对应的手牌容器
  const handEl = side === 'player' ? DOM.playerHand : DOM.aiHand;
  if (!handEl) return;

  // 创建一个带动画的卡牌元素
  const cardEl = createCardElement(card, 'card dealing');
  handEl.appendChild(cardEl);

  // 动画结束后去掉 dealing 类
  cardEl.addEventListener('animationend', () => {
    cardEl.classList.remove('dealing');
    // 玩家端发牌后，重新渲染一次完整手牌（保证拖拽序号、样式都对齐）
    if (side === 'player') {
      renderHands();
    } else {
      // AI 侧直接更新手牌数即可
      updateHandCount();
    }
  }, { once: true });
}
// === 出牌逻辑 ===

function aiPlayCard(idx) {
  if (idx === null) {
    state.passed.ai = true;
    return;
  }
  const card = state.hands.ai.splice(idx, 1)[0];
  placeCardOnBoard('ai', card);
  state.score.ai += card.power;
  state.battlefieldData.ai[card.type].push(card);
  updateScoreDisplay();
  updateHandCount();
  resolveAbilities('ai');
}
//玩家出牌
function playCard(idx, rowtype) {
  const card = state.hands.player.splice(idx, 1)[0];
  placeCardOnBoard('player', card);
  state.score.player += card.power;
  state.battlefieldData.player[rowtype].push(card);
  updateScoreDisplay();
  renderHands();
  updateHandCount();
  resolveAbilities('player');

  // AI 回应
  setTimeout(() => {
  if (!state.passed.ai && state.hands.ai.length > 0) {
    const aiIdx = decideAIMove({ state });
    aiPlayCard(aiIdx);
  } else {
    state.passed.ai = true;
  }
  checkRoundEnd();
}, 1000);
}

// 拖放到对应行触发出牌
function initDragAndDrop() {
  ['human','elf','wizard'].forEach(rowtype => {
    const zone = DOM.rows.player[rowtype];
    zone.addEventListener('dragover', e => e.preventDefault());
    zone.addEventListener('drop', e => {
      e.preventDefault();
      const data = JSON.parse(e.dataTransfer.getData('application/json') || '{}');
      if (data.type === rowtype) playCard(data.idx, rowtype);
    });
  });
}

// AI 连续出牌（玩家放弃后）
function aiAutoPlay() {
  // 如果已经放弃 或 没有手牌，就直接结束
  if (state.passed.ai || state.hands.ai.length === 0) {
    state.passed.ai = true;
    checkRoundEnd();
    return;
  }
  // 如果当前分数已经大于玩家，直接放弃
  if (state.score.ai > state.score.player) {
    console.log('[AI] 分数领先，停止出牌');
    state.passed.ai = true;
    checkRoundEnd();
    return;
  }

  // 还没赢，出一张牌
  const aiIdx = decideAIMove({ state });
  aiPlayCard(aiIdx);

  // 出完牌之后下一次检查
  setTimeout(aiAutoPlay, 800);
}
// 玩家点击“放弃”
DOM.passBtn.addEventListener('click', () => {
  state.passed.player = true;
  DOM.passBtn.disabled = true;
  aiAutoPlay();
});
// 检查回合结束
function checkRoundEnd() {
  // 只有双方都 pass，或者双方都没手牌，才结束
  const bothPassed = state.passed.player && state.passed.ai;
  const bothOutOfCards = state.hands.player.length === 0 && state.hands.ai.length === 0;
  if (!bothPassed && !bothOutOfCards) return;
  // === 判定胜负 ===
  if (state.score.player > state.score.ai) {
    state.lives.ai--;
    animateLifeLoss('ai');
    notification('您赢了本轮！');
  } else if (state.score.ai > state.score.player) {
    state.lives.player--;
    animateLifeLoss('player');
    notification('您输了本轮！');
  } else {
    state.lives.player--;
    state.lives.ai--;
    animateLifeLoss('player');
    animateLifeLoss('ai');
    notification('暂时平局');
  }
  renderLives();
if (state.lives.player === 0 || state.lives.ai === 0) {
  notification(
    state.lives.player === 0 ? '游戏结束，您输了！(失去50金币)' : '游戏结束，您获胜！',
    2500  // 显示 2.5 秒
  );
  DOM.passBtn.disabled = true;

  // 延迟提示重新开始
  setTimeout(() => {
    showRestartPrompt();
  }, 2600);
  return;
  }
  //---重置回合
  resetBattle();
}
// === 启动流程 ===
(function init() {
  state.deck = shuffle(cards);
  
  // 给玩家发牌
  let res = draw(state.deck);
  state.hands.player = res.hand;
  state.deck = res.remainingDeck;

  // 给 AI 发牌
  res = draw(state.deck);
  state.hands.ai = res.hand;
  state.deck = res.remainingDeck;

  renderHands({ withDealAnimation: true });
  renderLives();
  updateScoreDisplay();
  updateHandCount();
  initDragAndDrop();
})();
function notification(msg, duration = 1500, showRestart = false) {
  const noticeEl = document.querySelector('.notification');
  noticeEl.innerHTML = msg;
  noticeEl.classList.add('show');
  clearTimeout(noticeEl._timeoutId);

  if (showRestart) {
    const btn = document.createElement('button');
    btn.textContent = '再来一局';
    btn.className = 'restart-btn';
    btn.onclick = () => {
      noticeEl.classList.remove('show');
      restartGame(); 
    };
    noticeEl.appendChild(btn);
  } else {
    noticeEl._timeoutId = setTimeout(() => {
      noticeEl.classList.remove('show');
    }, duration);
  }
}
function restartGame() {
  // 重置生命和分数
  state.lives.player = 2;
  state.lives.ai = 2;

  state.score.player = 0;
  state.score.ai = 0;

  // 清空 buff / debuff
  state.princessDebuff.player = state.princessDebuff.ai = 0;
  state.sparkleCount.player   = state.sparkleCount.ai   = 0;
  state.healbuff.player = state.healbuff.ai = 0;
  state.trueLoveCount.player = state.trueLoveCount.ai = 0;

  // 清空战场 buff
  state.turnBuffs.player.bard = false;
  state.turnBuffs.ai.bard = false;
  state.turnBuffs.player.tokenRows.clear();
  state.turnBuffs.ai.tokenRows.clear();

  state.passed.player = false;
  state.passed.ai = false;

  // 重新洗牌、发牌
  state.deck = shuffle(cards);

  let res = draw(state.deck);
  state.hands.player = res.hand;
  state.deck = res.remainingDeck;

  res = draw(state.deck);
  state.hands.ai = res.hand;
  state.deck = res.remainingDeck;

  // 清空战场 DOM
  Object.values(DOM.rows.player).forEach(el => el.innerHTML = '');
  Object.values(DOM.rows.ai).forEach(el => el.innerHTML = '');

  // 渲染手牌
  renderHands({ withDealAnimation: true });
  initDragAndDrop();

  // 刷新生命、分数、手牌数量
  renderLives();
  updateScoreDisplay();
  updateHandCount();

  DOM.passBtn.disabled = false;
}
function showRestartPrompt() {
  const noticeEl = document.querySelector('.notification');
  noticeEl.textContent = '是否再来一局？请按 Enter';
  noticeEl.classList.add('show');
  function onKeyPress(e) {
    if (e.key === 'Enter') {
      noticeEl.classList.remove('show');
      window.removeEventListener('keydown', onKeyPress);
      restartGame();  // 重新初始化游戏
    }
  }
  window.removeEventListener('keydown', onKeyPress);
  window.addEventListener('keydown', onKeyPress);
}
// --- 重置回合
function resetBattle() {
  Object.values(DOM.rows.player).forEach(el => el.innerHTML = '');
  Object.values(DOM.rows.ai).forEach(el => el.innerHTML = '');

  state.score.player = state.score.ai = 0;

  ['player', 'ai'].forEach(side => {
    Object.keys(state.battlefieldData[side]).forEach(row => {
      state.battlefieldData[side][row] = [];
    });
    state.turnBuffs[side].bard = false;
    state.turnBuffs[side].tokenRows.clear();
  });

  state.princessDebuff.player = state.princessDebuff.ai = 0;
  state.sparkleCount.player   = state.sparkleCount.ai   = 0;
  state.healbuff.player = state.healbuff.ai = 0;

  state.passed.player = state.passed.ai = false;
  DOM.passBtn.disabled = false;

  updateScoreDisplay();
  renderHands();
  updateHandCount();
  renderLives();
}
// === 动画 

function animateLifeLoss(side) {
  const icons = DOM.lives[side].querySelectorAll('.life-icon');
  if (!icons.length) return;
  const last = icons[icons.length - 1];
  last.classList.add('lost');
  last.addEventListener('transitionend', () => last.remove(), { once: true });
}
//技能
function abilityNotice(side, ability) {
  const isPlayer = side === 'player';
  const messages = {
    kickTheBaby: isPlayer
      ? 'Dont kick the baby!您踢出了一个加拿大儿童并对敌方随机一张卡牌造成了致命伤害。'
      : 'Dont kick the baby!敌方踢出一个加拿大儿童,并对您的一张卡牌造成了致命伤害！',
    confuse: isPlayer
      ? '您的吟游诗人歌唱并趁机偷走了敌方卡牌。'
      : '敌方的吟游诗人歌唱并趁机偷走了您的卡牌,Goddamn bastard!',
    princess: isPlayer
      ? 'kenny公主魅惑了敌人并对其造成群体伤害'
      : 'Kenny公主魅惑了我们!(我方全体数值-1)'
  };

  if (messages[ability]) {
    notification(messages[ability]);
  }
}
const abilityHandlers = {
  princess({enemy,side}) {
    abilityNotice(side,'princess');
    state.princessDebuff[enemy]++;//敌方debuff加一层
//对敌方牌面标记
    recalScore(enemy);
  },
  sparkle({side}){
    ROWS.forEach(row=>{
      state.battlefieldData[side][row].forEach(card=>{
        if(card.ability=='sparkle')
          state.sparkleCount[side]++;//遍历所有行的每一个卡牌，如果技能为sparkle则count加一
        }
        )
      })
      if(state.sparkleCount[side]<2)
        return;//小于两张时无法发挥技能
      recalScore(side);
  },
  heal({side}) {
    state.healbuff[side]++;
    recalScore(side);
      const humanCount = state.battlefieldData[side]['human'].length;
      console.log('heal:', state.healbuff[side], 'humanCount:', humanCount);
  },
  confuse({side,enemy,bf}) {
    abilityNotice(side,'confuse');
    const all=[];
    ROWS.forEach(r=>{
      bf[enemy][r].forEach(c=>{
        all.push({
          ...c,
          row:r
        });
      })
    });
    if(all.length==0)
      return;//如果对方没有牌就算了
    //在对方牌区里随机抽两张
    const picks = [];
  const maxPick = Math.min(2, all.length);
  for (let i = 0; i < maxPick; i++) {
    const idx = Math.floor(Math.random() * all.length);
    picks.push(all[idx]);
    all.splice(idx, 1);
  }
  //对每张被夺的牌：
  picks.forEach(pick => {
    const { id, row } = pick;
    bf[enemy][row] = bf[enemy][row].filter(c => c.id !== id);
    removeCardFromDOM(enemy, row, id);
    delete pick._abilityTriggered;
    state.hands[side].push(pick);
    renderDealToHand(side, pick);
  });
  //重新计分
  recalScore(enemy);
  recalScore(side);
  //刷新手牌计数
  updateHandCount();
},
  kickTheBaby({ side, enemy, bf }) {
  const ownCards = ROWS.flatMap(r => bf[side][r]); 
  const hasKyle = ownCards.some(c => c.id === 'kyle');
  const hasIke  = ownCards.some(c => c.id === 'ike');
  if (!(hasKyle && hasIke)) return;

  console.log('[技能] kickTheBaby → 同时有 kyle 和 ike，击退敌方最强一张');
  abilityNotice(side,'kickTheBaby');
  let strongest = null, strongestRow = null;
  ROWS.forEach(r => {
    bf[enemy][r].forEach(c => {
      if (strongest === null || c.power > strongest.power) {
        strongest = c;
        strongestRow = r;
      }
    });
  });
  if (!strongest) return;

  bf[enemy][strongestRow] = bf[enemy][strongestRow].filter(c => c.id !== strongest.id);
  removeCardFromDOM(enemy, strongestRow, strongest.id);

  recalScore(enemy);
  recalScore(side);
  updateHandCount();
},
  trueLove({side}) {
    ROWS.forEach(row=>{
    state.battlefieldData[side][row].forEach(card=>{
    if(card.ability=='trueLove')
      state.trueLoveCount[side]++;
    })
    })
    if(state.trueLoveCount[side]<2)
      return;//小于两张时无法发挥技能
    recalScore(side);
  }
};
//！！！！
function resolveAbilities(side){
  const enemy = side === 'player' ? 'ai' : 'player';//side是当前出牌的一方，敌方就是另一方
  const bf=state.battlefieldData;//当前场上卡牌数据
  ROWS.forEach(row => {
    bf[side][row].forEach(card=>{//遍历每一行每张牌
      // 只有新上场且带 ability 的卡才触发
      if (card.ability && !card._abilityTriggered) {
        const handler = abilityHandlers[card.ability];
        if (handler) {
          handler({ side, enemy, bf });
          card._abilityTriggered = true;
        }
      }
    });
  });
}
// 重新计算分数
function recalScore(side) {
  const enemy = side === 'player' ? 'ai' : 'player';
  //重新统计数量
  let princessDebuffCount = 0;
  ROWS.forEach(row => {
    state.battlefieldData[enemy][row].forEach(card => {
      if (card.ability === 'princess') {
        princessDebuffCount++;
      }
    });
  });
  state.princessDebuff[side] = princessDebuffCount;
  let sparkleCount = 0;
  ROWS.forEach(row => {
    state.battlefieldData[side][row].forEach(card => {
      if (card.ability === 'sparkle') {
        sparkleCount++;
      }
    });
  });
  state.sparkleCount[side] = sparkleCount;
  let trueLoveCount = 0;
  ROWS.forEach(row => {
    state.battlefieldData[side][row].forEach(card => {
      if (card.ability === 'trueLove') {
        trueLoveCount++;
      }
    });
  });
  state.trueLoveCount[side] = trueLoveCount;
  let base = ROWS.reduce((sum, row) => {
    return sum + state.battlefieldData[side][row].reduce((s, c) => s + c.power, 0);
  }, 0);
  let cardCount = 0;
  ROWS.forEach(row => {
    cardCount += state.battlefieldData[side][row].length;
  });
  let total = base;
  total -= cardCount * state.princessDebuff[side];// princess debuff
  total += sparkleCount * (sparkleCount - 1);// sparkle buff
  const healBuff = state.healbuff[side];
  const humanCount = state.battlefieldData[side]['human'].length;
  total += healBuff * humanCount;// heal buff
  total += trueLoveCount * (trueLoveCount - 1);// trueLove buff
  state.score[side]=total;//传回
}
// 从 DOM 上移除卡牌
function removeCardFromDOM(enemy, row, cardId) {
  const rowEl = DOM.rows[enemy][row];
  const cardEl = rowEl.querySelector(`.card img[alt="${cardId}"]`)?.closest('.card');
  if (cardEl) cardEl.remove();
}
