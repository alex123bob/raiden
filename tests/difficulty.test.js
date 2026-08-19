import { describe, it, expect } from 'vitest';
import {
  diffMultFor, enemyHpScale, fireIntervalScale, extraBulletStreams,
  bossHpForStage, phaseCountForStage,
} from '../src/core/difficulty.js';

describe('difficulty', () => {
  it('ramps diffMult from 1.0 toward ~3.6, steepening past stage 8', () => {
    expect(diffMultFor(1, 1)).toBeCloseTo(1.00);
    expect(diffMultFor(8, 1)).toBeCloseTo(2.10);
    expect(diffMultFor(12, 1)).toBeCloseTo(3.00);
    expect(diffMultFor(18, 1)).toBeCloseTo(3.60);
    // steepening past stage 8: 12->18 (+1.5) is steeper than 6->8 (+0.45)
    const steep8 = diffMultFor(8, 1) - diffMultFor(6, 1);
    const steep18 = diffMultFor(18, 1) - diffMultFor(12, 1);
    expect(steep18).toBeGreaterThan(steep8);
  });

  it('applies the loop-stack multiplier', () => {
    expect(diffMultFor(1, 2)).toBeCloseTo(1.00 * 1.2);
    expect(diffMultFor(8, 3)).toBeCloseTo(2.10 * 1.4);
  });

  it('keeps early stages modest', () => {
    expect(diffMultFor(4, 1)).toBeCloseTo(1.30);
    expect(enemyHpScale(4)).toBeCloseTo(1.36);
  });

  it('scales enemy HP per stage', () => {
    expect(enemyHpScale(1)).toBeCloseTo(1.0);
    expect(enemyHpScale(18)).toBeCloseTo(1 + 17 * 0.12);
  });

  it('shrinks the enemy fire interval per stage', () => {
    expect(fireIntervalScale(1)).toBeCloseTo(1.0);
    expect(fireIntervalScale(18)).toBeCloseTo(Math.pow(0.97, 17));
  });

  it('adds one bullet stream per milestone reached', () => {
    expect(extraBulletStreams(3)).toBe(0);
    expect(extraBulletStreams(4)).toBe(1);
    expect(extraBulletStreams(12)).toBe(3);
    expect(extraBulletStreams(18)).toBe(4);
  });

  it('ramps boss HP 800 -> ~4500 and phases to 6', () => {
    expect(bossHpForStage(1)).toBe(800);
    expect(bossHpForStage(18)).toBe(4472);
    expect(phaseCountForStage(5)).toBe(3);
    expect(phaseCountForStage(6)).toBe(4);
    expect(phaseCountForStage(10)).toBe(5);
    expect(phaseCountForStage(15)).toBe(6);
    expect(phaseCountForStage(18)).toBe(6);
  });
});
