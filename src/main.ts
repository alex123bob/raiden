import './canvas.js';
import { VERSION } from './config.js';
import { Game } from './core/Game.js';
import { initInput } from './core/input.js';
import { CanvasRenderer } from './core/Renderer.js';
import { WebAudioBus } from './core/audio.js';
import { ctx } from './canvas.js';

const sha = import.meta.env.VITE_GIT_SHA;
console.log(`[RAIDEN] v${VERSION}${sha ? ` — commit ${sha}` : ' (dev)'}`);

const game = new Game({ renderer: new CanvasRenderer(ctx), audio: new WebAudioBus() });
initInput(game);
requestAnimationFrame(ts => { game.lastTime = ts; requestAnimationFrame(t => game.loop(t)); });
