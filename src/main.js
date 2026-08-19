import './canvas.js';
import { Game } from './core/Game.js';
import { initInput } from './core/input.js';

const game = new Game();
initInput(game);
requestAnimationFrame(ts => { game.lastTime = ts; requestAnimationFrame(game.loop); });
