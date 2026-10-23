import type { Catalog, Idea } from '../domain/types';

export type PickerPhase = 'idle' | 'drawing' | 'revealing' | 'result' | 'resetting' | 'reset' | 'exhausted' | 'empty' | 'error';
export type PickerState = {
  phase: PickerPhase;
  idea: Idea | null;
  catalog: Catalog | null;
  drawId: string | null;
  error: string | null;
};
export type PickerAction =
  | { type: 'DRAW_STARTED' }
  | { type: 'DRAW_COMMITTED'; idea: Idea; catalog: Catalog; drawId: string }
  | { type: 'DRAW_EXHAUSTED'; catalog: Catalog }
  | { type: 'DRAW_EMPTY'; catalog: Catalog }
  | { type: 'DRAW_FAILED'; message: string }
  | { type: 'RESET_STARTED' }
  | { type: 'RESET_COMMITTED' }
  | { type: 'RESET_FAILED'; message: string }
  | { type: 'REVEAL_FINISHED' }
  | { type: 'CLEAR' };

export const initialPickerState: PickerState = { phase: 'idle', idea: null, catalog: null, drawId: null, error: null };

export function pickerReducer(state: PickerState, action: PickerAction): PickerState {
  switch (action.type) {
    case 'DRAW_STARTED':
      return { ...state, phase: 'drawing', error: null };
    case 'DRAW_COMMITTED':
      return { phase: 'revealing', idea: action.idea, catalog: action.catalog, drawId: action.drawId, error: null };
    case 'DRAW_EXHAUSTED':
      return { ...state, phase: 'exhausted', catalog: action.catalog, error: null };
    case 'DRAW_EMPTY':
      return { ...initialPickerState, phase: 'empty', catalog: action.catalog };
    case 'DRAW_FAILED':
    case 'RESET_FAILED':
      return { ...state, phase: 'error', error: action.message };
    case 'RESET_STARTED':
      return { ...state, phase: 'resetting', error: null };
    case 'RESET_COMMITTED':
      return { ...initialPickerState, phase: 'reset' };
    case 'REVEAL_FINISHED':
      return state.phase === 'revealing' ? { ...state, phase: 'result' } : state;
    case 'CLEAR':
      return initialPickerState;
  }
}
