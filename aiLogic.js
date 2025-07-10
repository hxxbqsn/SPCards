export function decideAIMove({ state }) {
  const aiHand     = state.hands.ai;
  const plHand     = state.hands.player;
  const aiScore    = state.score.ai;
  const plScore    = state.score.player;
  const bfData     = state.battlefieldData;

  // 先评估“放弃”动作的价值
  let best = {
    idx: null,
    value: evaluate(
      aiScore, plScore,
      aiHand.length, plHand.length,
      /* rowCountAI */ 0, /* rowCountOpp */ 0,
      /* isPass */ true
    )
  };

  // 对每张手牌模拟出牌后的得分
  aiHand.forEach((card, i) => {
    const newAiScore    = aiScore + card.power;
    const newPlScore    = plScore;
    const newAiHandSize = aiHand.length - 1;
    const newPlHandSize = plHand.length;
    const row           = card.type; // 'human'|'elf'|'wizard'
    const rowCountAI    = bfData.ai[row].length;
    const rowCountOpp   = bfData.player[row].length;

    const val = evaluate(
      newAiScore, newPlScore,
      newAiHandSize, newPlHandSize,
      rowCountAI, rowCountOpp,
      /* isPass */ false
    );

    if (val > best.value) {
      best = { idx: i, value: val };
    }
  });

  return best.idx;
}


/**
 * 评估函数：值越高，AI 越倾向执行该动作
 * 
 * @param {number} aiScore
 * @param {number} plScore
 * @param {number} aiHandSize
 * @param {number} plHandSize
 * @param {number} rowCountAI
 * @param {number} rowCountOpp
 * @param {boolean} isPass
 * @returns {number}
 */
function evaluate(aiScore, plScore, aiHandSize, plHandSize,
                  rowCountAI, rowCountOpp, isPass) {
  // 分差
  const scoreDiff = aiScore - plScore;
  // 手牌差
  const handDiff  = aiHandSize - plHandSize;
  // 协同势能：自己该路已有牌
  const synergy    = rowCountAI * 0.5;
  // 抢占重点：对手该路已有牌
  const contention = rowCountOpp * 0.3;
  // 放弃惩罚：领先时可无惩罚，落后时-1.5
  const passPenalty = isPass
    ? (scoreDiff > 0 ? 0 : -1.5)
    : 0;

  // 权重
  const W_SCORE     = 1.0;
  const W_HAND      = 0.2;
  const W_SYNERGY   = 1.0;
  const W_CONTENT   = 1.0;

  return W_SCORE   * scoreDiff
       + W_HAND    * handDiff
       + W_SYNERGY * synergy
       + W_CONTENT * contention
       + passPenalty;
}