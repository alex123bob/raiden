// Application entry point: wires up the canvas, game, input, and starts the
// render/update loop. Kept intentionally thin — all logic lives in core/*.
import './canvas.js';                       // side-effect import: creates the canvas + ctx
import { VERSION } from './config.js';
import { Game } from './core/Game.js';
import { initInput } from './core/input.js';
import { CanvasRenderer } from './core/Renderer.js';
import { WebAudioBus } from './core/audio.js';
import { ctx } from './canvas.js';

// Git commit hash injected at build time by Vite; undefined in dev builds.
const sha = import.meta.env.VITE_GIT_SHA;
console.log(`[RAIDEN] v${VERSION}${sha ? ` — commit ${sha}` : ' (dev)'}`);

// Construct the game with its concrete renderer/audio dependencies injected.
const game = new Game({ renderer: new CanvasRenderer(ctx), audio: new WebAudioBus() });
initInput(game);
// Seed lastTime on the first frame so the initial dt is ~0, then drive game.loop.
requestAnimationFrame(ts => { game.lastTime = ts; requestAnimationFrame(t => game.loop(t)); });
