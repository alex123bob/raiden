import './canvas.js';
import { VERSION } from './config.js';
import { Game } from './core/Game.js';
import { initInput } from './core/input.js';

// `VITE_GIT_SHA` is injected by the GitHub Actions build (github.sha).
// In local `npm run dev` it's undefined, so the log falls back to a dev marker.
const sha = import.meta.env.VITE_GIT_SHA;
console.log(`[RAIDEN] v${VERSION}${sha ? ` — commit ${sha}` : ' (dev)'}`);

const game = new Game();
initInput(game);
requestAnimationFrame(ts => { game.lastTime = ts; requestAnimationFrame(game.loop); });
