import { ID } from '@vendure/core';

/** CDC G5: at most 5 levels from the top group down to the deepest one. */
export const MAX_HIERARCHY_LEVELS = 5;

export interface EdgeLike {
    parentId: ID;
    childId: ID;
}

/** Parent and child lookups of the group hierarchy, keyed by stringified id, edges in creation order. */
export interface GroupGraph {
    parents: ReadonlyMap<string, string[]>;
    children: ReadonlyMap<string, string[]>;
}

const key = (id: ID) => String(id);

function append(map: Map<string, string[]>, from: string, to: string) {
    map.set(from, [...(map.get(from) ?? []), to]);
}

export function buildGraph(edges: EdgeLike[]): GroupGraph {
    const parents = new Map<string, string[]>();
    const children = new Map<string, string[]>();
    for (const edge of edges) {
        append(parents, key(edge.childId), key(edge.parentId));
        append(children, key(edge.parentId), key(edge.childId));
    }
    return { parents, children };
}

/** Every group reachable through `links`, each once, nearest first. */
function reachable(links: ReadonlyMap<string, string[]>, start: ID): string[] {
    const seen = new Set<string>([key(start)]);
    const order: string[] = [];
    let frontier = [key(start)];
    while (frontier.length > 0) {
        const next = frontier.flatMap(id => links.get(id) ?? []).filter(id => !seen.has(id));
        const unique = [...new Set(next)];
        unique.forEach(id => seen.add(id));
        order.push(...unique);
        frontier = unique;
    }
    return order;
}

export const ancestorsOf = (graph: GroupGraph, id: ID) => reachable(graph.parents, id);
export const descendantsOf = (graph: GroupGraph, id: ID) => reachable(graph.children, id);

/** Number of levels on the longest chain through `links`, the group itself included. */
function longestChain(links: ReadonlyMap<string, string[]>, id: string, seen: ReadonlySet<string>): number {
    const next = (links.get(id) ?? []).filter(other => !seen.has(other));
    const nextSeen = new Set([...seen, id]);
    return 1 + Math.max(0, ...next.map(other => longestChain(links, other, nextSeen)));
}

export const levelsAbove = (graph: GroupGraph, id: ID) => longestChain(graph.parents, key(id), new Set());
export const levelsBelow = (graph: GroupGraph, id: ID) => longestChain(graph.children, key(id), new Set());

export type LinkProblem = 'self' | 'cycle' | 'too-deep' | null;

/** G3 + G5: why linking `childId` under `parentId` is refused, or null when allowed. */
export function linkProblem(graph: GroupGraph, childId: ID, parentId: ID): LinkProblem {
    if (key(childId) === key(parentId)) {
        return 'self';
    }
    if (descendantsOf(graph, childId).includes(key(parentId))) {
        return 'cycle';
    }
    return levelsAbove(graph, parentId) + levelsBelow(graph, childId) > MAX_HIERARCHY_LEVELS ? 'too-deep' : null;
}

/** G4: one path from a top group down to the parent of `id`, following the oldest parent link. */
export function breadcrumbOf(graph: GroupGraph, id: ID): string[] {
    const path: string[] = [];
    let current = graph.parents.get(key(id))?.[0];
    while (current && !path.includes(current) && path.length < MAX_HIERARCHY_LEVELS) {
        path.unshift(current);
        current = graph.parents.get(current)?.[0];
    }
    return path;
}
