export function nearestNode(nodes, x, z) {
  let best = nodes[0];
  let bestD = Infinity;
  for (const node of nodes) {
    const d = (node.x - x) ** 2 + (node.z - z) ** 2;
    if (d < bestD) {
      best = node;
      bestD = d;
    }
  }
  return best;
}

export function bfsPath(nodes, edges, startId, goalId) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  if (!byId.has(startId) || !byId.has(goalId)) return null;
  const adj = new Map();
  for (const edge of edges) {
    if (!adj.has(edge.a)) adj.set(edge.a, []);
    if (!adj.has(edge.b)) adj.set(edge.b, []);
    adj.get(edge.a).push(edge.b);
    adj.get(edge.b).push(edge.a);
  }
  const prev = new Map();
  const queue = [startId];
  prev.set(startId, null);
  while (queue.length) {
    const current = queue.shift();
    if (current === goalId) break;
    for (const next of adj.get(current) || []) {
      if (prev.has(next)) continue;
      prev.set(next, current);
      queue.push(next);
    }
  }
  if (!prev.has(goalId)) return null;
  const ids = [];
  let cursor = goalId;
  while (cursor) {
    ids.push(cursor);
    cursor = prev.get(cursor);
  }
  ids.reverse();
  return ids.map((id) => byId.get(id));
}

export function pathLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
  }
  return total;
}
