import { makeRegistry } from '../../core/registry.js';
import type { BgFeature } from '../../stages/background.js';
import { rocks } from './rocks.js';
import { clouds } from './clouds.js';
import { bubbles } from './bubbles.js';
import { streaks } from './streaks.js';
import { hulls } from './hulls.js';
import { wisps } from './wisps.js';
import { walls } from './walls.js';
import { stars } from './stars.js';

/** Registry of all parallax background layers, keyed by BgFeature.key. */
export const BG_FEATURES = makeRegistry<BgFeature>();
/** Convenience alias for BG_FEATURES.register. */
export const registerBgFeature = BG_FEATURES.register;
registerBgFeature(rocks);     // downward-drifting rock/asteroid silhouettes
registerBgFeature(clouds);    // soft downward-drifting cloud blobs
registerBgFeature(bubbles);   // upward-rising, side-wobbling bubbles
registerBgFeature(streaks);   // fast downward motion-blur streaks
registerBgFeature(hulls);     // slow downward wreckage/hull-plate silhouettes
registerBgFeature(wisps);     // static drifting curved light wisps (no scroll)
registerBgFeature(walls);     // sine-wobbling canyon walls + rising embers
registerBgFeature(stars);     // always-on, per-stage-tinted multi-layer starfield
