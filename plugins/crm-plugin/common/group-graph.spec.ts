import { describe, expect, it } from 'vitest';

import { ancestorsOf, breadcrumbOf, buildGraph, descendantsOf, levelsAbove, levelsBelow, linkProblem } from './group-graph';

const graph = buildGraph([
    { parentId: 1, childId: 2 },
    { parentId: 1, childId: 3 },
    { parentId: 2, childId: 4 },
    { parentId: 3, childId: 4 },
    { parentId: 4, childId: 5 },
]);

describe('group graph', () => {
    it('lists ancestors and descendants once each through a diamond', () => {
        expect(ancestorsOf(graph, 5)).toEqual(['4', '2', '3', '1']);
        expect(descendantsOf(graph, 1)).toEqual(['2', '3', '4', '5']);
    });

    it('counts levels on the longest chain, the group included', () => {
        expect(levelsAbove(graph, 5)).toBe(4);
        expect(levelsBelow(graph, 1)).toBe(4);
        expect(levelsBelow(graph, 5)).toBe(1);
    });

    it('detects self links, loops and excessive depth', () => {
        expect(linkProblem(graph, 1, 1)).toBe('self');
        expect(linkProblem(graph, 1, 5)).toBe('cycle');
        expect(linkProblem(buildGraph([]), 7, 8)).toBeNull();
        const deep = buildGraph([1, 2, 3, 4].map(n => ({ parentId: n, childId: n + 1 })));
        expect(linkProblem(deep, 6, 4)).toBeNull();
        expect(linkProblem(deep, 6, 5)).toBe('too-deep');
    });

    it('follows the oldest parent for the breadcrumb', () => {
        expect(breadcrumbOf(graph, 5)).toEqual(['1', '2', '4']);
        expect(breadcrumbOf(graph, 1)).toEqual([]);
    });
});
