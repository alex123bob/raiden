import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkGraze, checkPlayerBulletsVsEnemies, GRAZE_RADIUS } from '../src/core/collision.js';
import { createBoss, onBossDeath } from '../src/entities/Boss.js';
import {
  awardScore,
  awardStageBonuses,
  calculateStageBonuses,
  COMBO_WINDOW,
  GRAZE_SCORE,
  MAX_COMBO,
  updateScoring,
} from '../src/core/scoring.js';
import { stubContext } from './context-stub.js';

afterEach(() => vi.restoreAllMocks());

function enemy(score: number, hp = 1) {
  return {
    x: 100, y: 100, r: 10, hp, score,
    def: { key: 'fighter' }, color: '#66aaff', dropChance: 0,
  } as never;
}

function playerBullet(dmg = 2) {
  return { x: 100, y: 100, r: 5, dmg, def: { key: 'vulcan' }, lv: 1, pierce: false } as never;
}

function enemyBullet(x: number, y: number) {
  return { x, y, r: 3, vx: 0, vy: 0, dmg: 1 } as never;
}

describe('scoring combo', () => {
  it('applies loop and combo multipliers, then resets after the combo window', () => {
    const g = stubContext({ loopMult: 2 });

    expect(awardScore(g, 100, 'enemy')).toBe(200);
    expect(g.score).toBe(200);
    expect(g.combo).toBe(1);

    expect(awardScore(g, 100, 'enemy')).toBe(400);
    expect(g.score).toBe(600);
    expect(g.combo).toBe(2);
    expect(g.maxCombo).toBe(2);

    updateScoring(COMBO_WINDOW + 0.01, g);
    expect(g.combo).toBe(0);
    expect(g.comboTimer).toBe(0);

    expect(awardScore(g, 100, 'enemy')).toBe(200);
    expect(g.combo).toBe(1);
  });

  it('caps the combo multiplier', () => {
    const g = stubContext();
    for (let i = 0; i < MAX_COMBO + 3; i++) awardScore(g, 10, 'enemy');
    expect(g.combo).toBe(MAX_COMBO);
    expect(g.maxCombo).toBe(MAX_COMBO);
  });

  it('regular enemy collision scoring flows through combo awards', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const g = stubContext();
    g.enemies.push(enemy(100));
    g.playerBullets.push(playerBullet());
    checkPlayerBulletsVsEnemies(g);
    g.enemies.push(enemy(100));
    g.playerBullets.push(playerBullet());

    checkPlayerBulletsVsEnemies(g);

    expect(g.score).toBe(300); // 100 at x1, then 100 at x2.
    expect(g.combo).toBe(2);
  });
});

describe('graze scoring', () => {
  it('awards graze points exactly once per bullet', () => {
    const g = stubContext();
    g.player!.x = 100; g.player!.y = 100; g.player!.invTimer = 0; g.player!.dead = false;
    const gap = g.player!.r + GRAZE_RADIUS - 2;
    g.enemyBullets.push(enemyBullet(100 + gap, 100));

    checkGraze(g);
    expect(g.score).toBe(GRAZE_SCORE);
    expect((g.enemyBullets[0] as { grazed?: boolean }).grazed).toBe(true);

    checkGraze(g);
    expect(g.score).toBe(GRAZE_SCORE);
  });
});

describe('stage bonuses', () => {
  it('calculates loop-scaled no-miss and no-bomb bonuses', () => {
    const award = calculateStageBonuses(3, 2, true, true);
    expect(award.noMissAward).toBe((2000 + 3 * 750) * 2);
    expect(award.noBombAward).toBe((1000 + 3 * 500) * 2);
    expect(award.total).toBe(award.noMissAward + award.noBombAward);
  });

  it('awards and stores the stage-clear bonus result on the context', () => {
    const g = stubContext({ currentStage: 2, loopMult: 1 });
    const award = awardStageBonuses(g);
    expect(g.score).toBe(award.total);
    expect(g.lastStageBonus).toEqual(award);
    expect(g.combo).toBe(0);
  });

  it('does not award missed bonus categories', () => {
    const g = stubContext({ currentStage: 2, stageNoMiss: false, stageNoBomb: false });
    const award = awardStageBonuses(g);
    expect(award.total).toBe(0);
    expect(g.score).toBe(0);
  });

  it('boss death awards boss score plus stage performance bonuses', () => {
    const g = stubContext({ currentStage: 1, loopMult: 1 });
    g.boss = createBoss(g);

    onBossDeath(g);

    expect(g.state).toBe(4);
    expect(g.lastStageBonus!.total).toBe((2000 + 750) + (1000 + 500));
    expect(g.score).toBe(7000 + g.lastStageBonus!.total);
  });
});
