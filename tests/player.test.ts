import { describe, it, expect } from 'vitest';
import { stubContext } from './context-stub.js';

describe('Player', () => {
  it('clamps movement to the play field', () => {
    const g = stubContext();
    const p = g.player!;
    p.x = 10; p.y = 10;
    g.keys['ArrowLeft'] = true;
    g.keys['ArrowUp'] = true;
    p.update(1 / 60, g);
    expect(p.x).toBe(p.r);
    expect(p.y).toBe(p.r);
    p.x = 500; p.y = 700;
    g.keys = { ArrowRight: true, ArrowDown: true };
    p.update(1 / 60, g);
    expect(p.x).toBe(480 - p.r);
    expect(p.y).toBe(640 - p.r);
  });

  it('bomb consumes one bomb, clears enemy bullets, and damages enemies and boss', () => {
    const g = stubContext();
    const p = g.player!;
    p.bombs = 1;
    g.enemyBullets = [{ x: 0, y: 0, vx: 0, vy: 0, r: 4, clr: '#fff' }] as never;
    g.enemies = [{ hp: 100 }] as never;
    g.boss = { hp: 1000 } as never;
    g.keys['KeyB'] = true;
    p.update(1 / 60, g);
    expect(p.bombs).toBe(0);
    expect((g.enemyBullets as unknown as unknown[]).length).toBe(0);
    expect((g.enemies as unknown as { hp: number }[])[0].hp).toBe(40);
    expect((g.boss as unknown as { hp: number }).hp).toBe(750);
    g.keys['KeyB'] = true;
    p.bombs = 1;
    p.update(1 / 60, g);
    expect(p.bombs).toBe(1);
    g.keys['KeyB'] = false;
    p.update(1 / 60, g);
    expect(g.keys['_bombUsed']).toBe(false);
  });

  it('bomb triggers a screen shake', () => {
    const g = stubContext();
    let shaken = 0;
    g.shake = (mag: number) => { shaken = mag; };
    const p = g.player!;
    p.bombs = 1;
    g.keys['KeyB'] = true;
    p.update(1 / 60, g);
    expect(shaken).toBeGreaterThan(0);
  });

  it('death resets weapons and respawns at center with invulnerability', () => {
    const g = stubContext();
    const p = g.player!;
    p.weapons = [{ type: 1, lv: 4 }];
    p.lives = 2;
    p.kill(g);
    expect(p.dead).toBe(true);
    expect(p.weapons).toEqual([{ type: 0, lv: 1 }]);
    p.update(2.1, g);
    expect(p.dead).toBe(false);
    expect(p.x).toBe(240);
    expect(p.y).toBe(540);
    expect(p.invTimer).toBe(3.0);
  });

  it('game over after last life transitions to GAMEOVER', () => {
    const g = stubContext();
    const p = g.player!;
    p.lives = 1;
    p.kill(g);
    expect(p.gameOverTimer).toBe(1.8);
    p.update(2.0, g);
    expect(g.state).toBe(3);
  });

  it('max-level fire shoots continuously while held (no hold-and-release gate)', () => {
    const g = stubContext();
    const p = g.player!;
    p.x = 240; p.y = 500;
    p.weapons = [{ type: 0, lv: 5 }];
    g.keys['Space'] = true;
    // First tick fires immediately; the gun never goes quiet while held.
    p.update(1 / 60, g);
    expect(g.playerBullets.length).toBeGreaterThan(0);
    const afterFirst = g.playerBullets.length;
    // Advance past the fire-rate cooldown -> another volley, still holding.
    for (let i = 0; i < 20; i++) p.update(1 / 60, g);
    expect(g.playerBullets.length).toBeGreaterThan(afterFirst);
  });

  it('max-level charge auto-unleashes a super burst when the meter fills, without releasing', () => {
    const g = stubContext();
    const p = g.player!;
    p.x = 240; p.y = 500;
    p.weapons = [{ type: 0, lv: 5 }];
    g.keys['Space'] = true;
    // Hold long enough to fill the charge meter (CHARGE_DURATION = 1.0s).
    for (let i = 0; i < 70; i++) p.update(1 / 60, g);
    // The 12-bullet super volley (r 6, dmg 15) fired among the normal shots.
    const superShots = g.playerBullets.filter(b => b.r === 6 && b.dmg === 15);
    expect(superShots.length).toBe(12);
    // Meter rolled over rather than latching full.
    expect(p.chargeTime).toBeLessThan(1.0);
  });

  it('a maxed weapon in a non-zero combo slot still charges and super-fires', () => {
    const g = stubContext();
    const p = g.player!;
    p.x = 240; p.y = 500;
    // Slot 0 is a non-maxed missile; slot 1 is a maxed vulcan.
    p.weapons = [{ type: 2, lv: 3 }, { type: 0, lv: 5 }];
    g.keys['Space'] = true;
    for (let i = 0; i < 70; i++) p.update(1 / 60, g);
    // The vulcan super volley (12 bullets, r6 dmg15) fired despite slot 0 not being maxed.
    const superShots = g.playerBullets.filter(b => b.r === 6 && b.dmg === 15);
    expect(superShots.length).toBe(12);
    expect(p.charging).toBe(true);
  });
});
