import { useState, useCallback } from "react";

interface SceneNote {
  id: string;
  text: string;
  type: "production" | "reminder" | "comment";
  createdAt: string;
}

interface Scene {
  scene_number: number;
  setting: string;
  description: string;
  camera_angle?: string;
  dialogue: { character: string; line: string; emotion: string }[];
  action: string;
  notes?: SceneNote[];
}

interface HistoryState {
  past: Scene[][];
  present: Scene[];
  future: Scene[][];
}

const MAX_HISTORY_SIZE = 50;

export const useSceneHistory = (initialScenes: Scene[] = []) => {
  const [history, setHistory] = useState<HistoryState>({
    past: [],
    present: initialScenes,
    future: [],
  });

  const setScenes = useCallback((newScenes: Scene[], addToHistory = true) => {
    setHistory((prev) => {
      if (!addToHistory) {
        return { ...prev, present: newScenes };
      }

      // Don't add to history if scenes are the same
      if (JSON.stringify(prev.present) === JSON.stringify(newScenes)) {
        return prev;
      }

      const newPast = [...prev.past, prev.present].slice(-MAX_HISTORY_SIZE);
      return {
        past: newPast,
        present: newScenes,
        future: [], // Clear future when new changes are made
      };
    });
  }, []);

  const undo = useCallback(() => {
    setHistory((prev) => {
      if (prev.past.length === 0) return prev;

      const newPast = prev.past.slice(0, -1);
      const previousState = prev.past[prev.past.length - 1];

      return {
        past: newPast,
        present: previousState,
        future: [prev.present, ...prev.future].slice(0, MAX_HISTORY_SIZE),
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((prev) => {
      if (prev.future.length === 0) return prev;

      const nextState = prev.future[0];
      const newFuture = prev.future.slice(1);

      return {
        past: [...prev.past, prev.present].slice(-MAX_HISTORY_SIZE),
        present: nextState,
        future: newFuture,
      };
    });
  }, []);

  const reset = useCallback((scenes: Scene[]) => {
    setHistory({
      past: [],
      present: scenes,
      future: [],
    });
  }, []);

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  return {
    scenes: history.present,
    setScenes,
    undo,
    redo,
    reset,
    canUndo,
    canRedo,
    historyLength: history.past.length,
    futureLength: history.future.length,
  };
};
