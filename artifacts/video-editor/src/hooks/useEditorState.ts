import { createContext, useContext, useReducer, useCallback, useEffect, useRef } from "react";
import { Track, TimelineItem, TimelineData } from "../domain/editor";

export type EditorAction =
  | { type: "INIT_TIMELINE"; payload: TimelineData }
  | { type: "SET_PLAYHEAD"; payload: number }
  | { type: "ADVANCE_PLAYHEAD"; payload: number }
  | { type: "TOGGLE_PLAY" }
  | { type: "SET_PLAYBACK_RATE"; payload: number }
  | { type: "SET_PLAYING"; payload: boolean }
  | { type: "SET_ZOOM"; payload: number }
  | { type: "SELECT_ITEM"; payload: { id: string; multi: boolean } }
  | { type: "DESELECT_ALL" }
  | { type: "MOVE_ITEM"; payload: { id: string; trackId: string; startMs: number } }
  | { type: "TRIM_ITEM"; payload: { id: string; startMs: number; durationMs: number; trimStartMs: number; trimEndMs: number } }
  | { type: "SPLIT_ITEM"; payload: { itemId: string; atMs: number; newId: string } }
  | { type: "DELETE_SELECTED" }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "ADD_ITEM"; payload: TimelineItem }
  | { type: "ADD_TRACK"; payload: Track };

export interface EditorState {
  tracks: Track[];
  items: TimelineItem[];
  selectedItemIds: string[];
  playheadMs: number;
  isPlaying: boolean;
  playbackRate: number;
  zoomMsPerPixel: number; // ms per pixel, lower is zoomed in
  history: { tracks: Track[]; items: TimelineItem[] }[];
  historyIndex: number;
}

const initialState: EditorState = {
  tracks: [],
  items: [],
  selectedItemIds: [],
  playheadMs: 0,
  isPlaying: false,
  playbackRate: 1,
  zoomMsPerPixel: 100, // 100ms per pixel
  history: [],
  historyIndex: -1,
};

function cloneTimeline(tracks: Track[], items: TimelineItem[]) {
  return { tracks: [...tracks], items: items.map(i => ({ ...i })) };
}

function reducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "INIT_TIMELINE": {
      return {
        ...state,
        tracks: action.payload.tracks,
        items: action.payload.items,
        history: [{ tracks: action.payload.tracks, items: action.payload.items }],
        historyIndex: 0,
      };
    }
    case "SET_PLAYHEAD":
      return { ...state, playheadMs: Math.max(0, action.payload) };
    case "ADVANCE_PLAYHEAD":
      return { ...state, playheadMs: Math.max(0, state.playheadMs + action.payload) };
    case "TOGGLE_PLAY":
      return { ...state, isPlaying: !state.isPlaying, playbackRate: 1 };
    case "SET_PLAYBACK_RATE":
      return { ...state, playbackRate: action.payload, isPlaying: action.payload !== 0 };
    case "SET_PLAYING":
      return { ...state, isPlaying: action.payload, playbackRate: action.payload ? 1 : 0 };
    case "SET_ZOOM":
      return { ...state, zoomMsPerPixel: Math.max(10, Math.min(5000, action.payload)) };
    case "SELECT_ITEM": {
      const { id, multi } = action.payload;
      if (multi) {
        const isSelected = state.selectedItemIds.includes(id);
        return {
          ...state,
          selectedItemIds: isSelected ? state.selectedItemIds.filter(x => x !== id) : [...state.selectedItemIds, id],
        };
      }
      return { ...state, selectedItemIds: [id] };
    }
    case "DESELECT_ALL":
      return { ...state, selectedItemIds: [] };
    case "MOVE_ITEM": {
      const { id, trackId, startMs } = action.payload;
      const items = state.items.map(item =>
        item.id === id ? { ...item, trackId, startMs: Math.max(0, startMs) } : item
      );
      return pushHistory({ ...state, items });
    }
    case "TRIM_ITEM": {
      const { id, startMs, durationMs, trimStartMs, trimEndMs } = action.payload;
      const items = state.items.map(item =>
        item.id === id ? { ...item, startMs: Math.max(0, startMs), durationMs: Math.max(100, durationMs), trimStartMs: Math.max(0, trimStartMs), trimEndMs: Math.max(0, trimEndMs) } : item
      );
      return pushHistory({ ...state, items });
    }
    case "SPLIT_ITEM": {
      const { itemId, atMs, newId } = action.payload;
      const itemToSplit = state.items.find(i => i.id === itemId);
      if (!itemToSplit || atMs <= itemToSplit.startMs || atMs >= itemToSplit.startMs + itemToSplit.durationMs) {
        return state;
      }
      const splitOffsetMs = atMs - itemToSplit.startMs;
      const firstPart: TimelineItem = {
        ...itemToSplit,
        durationMs: splitOffsetMs,
        trimEndMs: itemToSplit.trimEndMs + (itemToSplit.durationMs - splitOffsetMs)
      };
      const secondPart: TimelineItem = {
        ...itemToSplit,
        id: newId,
        startMs: atMs,
        durationMs: itemToSplit.durationMs - splitOffsetMs,
        trimStartMs: itemToSplit.trimStartMs + splitOffsetMs
      };
      const items = state.items.filter(i => i.id !== itemId).concat([firstPart, secondPart]);
      return pushHistory({ ...state, items });
    }
    case "DELETE_SELECTED": {
      if (state.selectedItemIds.length === 0) return state;
      const items = state.items.filter(i => !state.selectedItemIds.includes(i.id));
      return pushHistory({ ...state, items, selectedItemIds: [] });
    }
    case "ADD_ITEM": {
      return pushHistory({ ...state, items: [...state.items, action.payload] });
    }
    case "ADD_TRACK": {
      return pushHistory({ ...state, tracks: [...state.tracks, action.payload] });
    }
    case "UNDO": {
      if (state.historyIndex > 0) {
        const newIndex = state.historyIndex - 1;
        const entry = state.history[newIndex]!;
        return { ...state, tracks: entry.tracks, items: entry.items, historyIndex: newIndex };
      }
      return state;
    }
    case "REDO": {
      if (state.historyIndex < state.history.length - 1) {
        const newIndex = state.historyIndex + 1;
        const entry = state.history[newIndex]!;
        return { ...state, tracks: entry.tracks, items: entry.items, historyIndex: newIndex };
      }
      return state;
    }
    default:
      return state;
  }
}

function pushHistory(state: EditorState): EditorState {
  const newEntry = cloneTimeline(state.tracks, state.items);
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push(newEntry);
  if (newHistory.length > 50) newHistory.shift();
  return { ...state, history: newHistory, historyIndex: newHistory.length - 1 };
}

export const EditorContext = createContext<{
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
} | null>(null);

export function useEditor() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditor must be used within EditorProvider");
  return ctx;
}

export function useEditorReducer() {
  return useReducer(reducer, initialState);
}
