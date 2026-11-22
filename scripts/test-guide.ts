import { bfsPath, nearestNode, pathLength } from '../public/campus-guide/path.js';
import waypoints from '../content/waypoints.json' with { type: 'json' };
import {
  acceptableChildLine,
  cannedAnimalLine,
  containsBanned,
  helpUsageLine,
} from '../src/server/guideSafety';
import { animalReply, finalizeAnimalReply, finalizeIdeas, suggestIdeas } from '../src/server/guideAi';

const nodes = waypoints.nodes;
const edges = waypoints.edges;

function route(fromId: string, toId: string) {
  const from = nodes.find((node) => node.id === fromId)!;
  const withPlayer = [...nodes, { id: 'player', x: from.x, z: from.z }];
  const withEdge = [...edges, { a: 'player', b: fromId }];
  return bfsPath(withPlayer, withEdge, 'player', toId);
}

const lake = route('dog', 'lake');
const tower = route('green', 'tower');
if (!lake || lake[lake.length - 1].id !== 'lake') throw new Error('lake path missing');
if (!tower || tower[tower.length - 1].id !== 'tower') throw new Error('tower path missing');
if (pathLength(lake) <= 0) throw new Error('lake path has no length');
const near = nearestNode(nodes, 2.5, 4);
if (near.id !== 'green' && near.id !== 'path-b' && near.id !== 'dog') {
  throw new Error(`unexpected nearest node ${near.id}`);
}

if (containsBanned('a kind hello')) throw new Error('clean line was blocked');
if (!containsBanned('this is a diagnosis')) throw new Error('banned word slipped through');
if (acceptableChildLine('Draw the soft ears.', 12) !== true) throw new Error('short line rejected');
if (acceptableChildLine('one two three four five six seven eight nine ten eleven twelve thirteen', 12) !== false) {
  throw new Error('long line accepted');
}

const bad = finalizeAnimalReply({ reply: 'This sounds like a diagnosis of the day.', suggestDraw: true }, 'dog');
if (!bad.fallback || containsBanned(bad.reply)) throw new Error('unsafe reply was kept');
const good = finalizeAnimalReply({ reply: 'The dog wags hello. Want to draw those ears?', suggestDraw: true }, 'dog');
if (good.fallback) throw new Error('safe reply was replaced');

const ideas = finalizeIdeas(['Draw a scary monster now', 'too short', 'nope'], [
  'Draw the dog\'s ears in the sun.',
  'Write about the dog\'s warm fur.',
  'Sketch the grass by the dog\'s paws.',
]);
if (!ideas.fallback || ideas.ideas.some((idea) => containsBanned(idea))) throw new Error('idea fallback failed');

const line = helpUsageLine(2, 1);
if (!line.includes('2 times this week') || !line.includes('1 time')) throw new Error(line);
if (helpUsageLine(0, 0) !== 'Help has not been used yet.') throw new Error('empty help line');

delete process.env.GEMINI_API_KEY;
delete process.env.GEMINI_TEXT_MODEL;
delete process.env.GEMINI_SAFETY_MODEL;
const canned = await animalReply({ kind: 'dog', name: 'the campus dog', text: 'fluffy ears' });
if (!canned.fallback || canned.reply !== cannedAnimalLine('dog').reply) throw new Error('missing key did not use the canned line');
const ideaFallback = await suggestIdeas({ questId: 'watch-the-lake', simulateFailure: true });
if (ideaFallback.ideas.length !== 3 || !ideaFallback.fallback) throw new Error('idea failure did not fall back');
if (ideaFallback.ideas.some((idea) => containsBanned(idea))) throw new Error('fallback idea was blocked');

console.log('guide tests passed');
