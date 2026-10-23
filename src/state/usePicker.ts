import { useCallback, useEffect, useReducer, useRef } from 'react';
import { errorMessage } from '../services/errors';
import { useAppServices } from './authState';
import { initialPickerState, pickerReducer } from './pickerReducer';
import { useSound } from './soundState';

export function usePicker(userId: string | null) {
  const services = useAppServices();
  const { prepareAudio, play, stopSounds } = useSound();
  const [state, dispatch] = useReducer(pickerReducer, initialPickerState);
  const generation = useRef(0);
  const pending = useRef(false);
  const activeReveal = useRef<string | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    generation.current += 1;
    pending.current = false;
    activeReveal.current = null;
    dispatch({ type: 'CLEAR' });
    return () => {
      mounted.current = false;
      generation.current += 1;
      pending.current = false;
      activeReveal.current = null;
      stopSounds();
    };
  }, [userId, stopSounds]);

  const draw = useCallback(async (categoryId: string, reset = false) => {
    if (!userId || pending.current || !mounted.current) return;
    pending.current = true;
    activeReveal.current = null;
    const request = ++generation.current;
    // Prepare audio in the original click stack, before awaiting the transaction.
    prepareAudio();
    play('whoosh');
    dispatch({ type: 'DRAW_STARTED' });

    try {
      const result = await services.drawIdea(categoryId, reset);
      if (!mounted.current || request !== generation.current) return;
      if (result.kind === 'drawn') {
        activeReveal.current = result.drawId;
        dispatch({ type: 'DRAW_COMMITTED', idea: result.idea, catalog: result.catalog, drawId: result.drawId });
        play('chime');
        // Keep the lock through the reveal, until its animation completes.
      } else {
        stopSounds();
        pending.current = false;
        dispatch({ type: result.kind === 'exhausted' ? 'DRAW_EXHAUSTED' : 'DRAW_EMPTY', catalog: result.catalog });
      }
    } catch (reason) {
      if (!mounted.current || request !== generation.current) return;
      pending.current = false;
      stopSounds();
      dispatch({ type: 'DRAW_FAILED', message: errorMessage(reason, 'Не вдалося вибрати пригоду. Спробуйте ще раз.') });
    }
  }, [userId, services, prepareAudio, play, stopSounds]);

  const finishReveal = useCallback(() => {
    if (state.phase !== 'revealing' || !state.drawId || activeReveal.current !== state.drawId) return;
    activeReveal.current = null;
    pending.current = false;
    dispatch({ type: 'REVEAL_FINISHED' });
  }, [state.phase, state.drawId]);

  const clear = useCallback(() => {
    generation.current += 1;
    pending.current = false;
    activeReveal.current = null;
    stopSounds();
    dispatch({ type: 'CLEAR' });
  }, [stopSounds]);

  const reset = useCallback((categoryId: string) => draw(categoryId, true), [draw]);

  return {
    ...state,
    status: state.phase,
    busy: state.phase === 'drawing' || state.phase === 'revealing',
    draw,
    reset,
    clear,
    finishReveal,
  };
}
