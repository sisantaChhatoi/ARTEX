import type { CoverageGraphEdge, CoverageGraphNode } from "@/lib/types";

export type CoverageGraphData = {
  nodes: CoverageGraphNode[];
  edges: CoverageGraphEdge[];
};

export type CoverageGraphSelection = {
  /** Asset shown in the asset detail sheet. */
  asset: CoverageGraphNode | null;
  /** Key of the fold node shown in the fold sheet. */
  foldId: string | null;
};

export type CoverageGraphState = {
  /** Null until the first successful fetch; a failed refetch keeps the previous data. */
  data: CoverageGraphData | null;
  loading: boolean;
  /** Fold group id → number of children shown (groups not in the map use the default limit). */
  expanded: Map<string, number>;
  selection: CoverageGraphSelection;
};

export type CoverageGraphAction =
  | { type: "fetchStarted" }
  | { type: "fetched"; data: CoverageGraphData }
  | { type: "fetchFinished" }
  | { type: "foldExpanded"; groupId: string; defaultShown: number; step: number }
  | { type: "assetSelected"; asset: CoverageGraphNode | null }
  | { type: "foldSelected"; foldId: string | null }
  | { type: "foldItemPicked"; asset: CoverageGraphNode };

export function initCoverageGraphState(): CoverageGraphState {
  return {
    data: null,
    loading: true,
    expanded: new Map(),
    selection: { asset: null, foldId: null },
  };
}

export function coverageGraphReducer(state: CoverageGraphState, action: CoverageGraphAction): CoverageGraphState {
  switch (action.type) {
    case "fetchStarted":
      return { ...state, loading: true };
    case "fetched":
      return { ...state, data: action.data };
    case "fetchFinished":
      return { ...state, loading: false };
    case "foldExpanded": {
      const expanded = new Map(state.expanded);
      expanded.set(action.groupId, (expanded.get(action.groupId) ?? action.defaultShown) + action.step);
      return { ...state, expanded };
    }
    case "assetSelected":
      return { ...state, selection: { ...state.selection, asset: action.asset } };
    case "foldSelected":
      return { ...state, selection: { ...state.selection, foldId: action.foldId } };
    case "foldItemPicked":
      // Picking a hidden child closes the fold sheet and opens that asset.
      return { ...state, selection: { asset: action.asset, foldId: null } };
  }
}
