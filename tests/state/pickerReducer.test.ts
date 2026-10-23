import { describe, expect, it } from 'vitest';
import { initialPickerState, pickerReducer } from '../../src/state/pickerReducer';
import type { Catalog } from '../../src/domain/types';

const idea = { id: 'synthetic-a', categoryId: 'synthetic-category', markdown: 'Намалюйте вигадану планету.' };
const catalog: Catalog = { ideas: [idea], categories: [{ id: idea.categoryId, name: 'Уява', count: 1 }] };

describe('pickerReducer', () => {
  it('reveals only a committed selection and finishes its animation', () => {
    const drawing = pickerReducer(initialPickerState, { type: 'DRAW_STARTED' });
    expect(drawing).toMatchObject({ phase: 'drawing', idea: null });
    const revealing = pickerReducer(drawing, { type: 'DRAW_COMMITTED', idea, catalog, drawId: 'draw-1' });
    expect(revealing).toMatchObject({ phase: 'revealing', idea, drawId: 'draw-1' });
    expect(pickerReducer(revealing, { type: 'REVEAL_FINISHED' }).phase).toBe('result');
  });

  it('keeps the previous idea while drawing and after a failed request', () => {
    const previous = pickerReducer(initialPickerState, { type: 'DRAW_COMMITTED', idea, catalog, drawId: 'draw-1' });
    const drawing = pickerReducer(previous, { type: 'DRAW_STARTED' });
    const failed = pickerReducer(drawing, { type: 'DRAW_FAILED', message: 'Спробуйте ще раз.' });
    expect(failed).toMatchObject({ phase: 'error', idea, error: 'Спробуйте ще раз.' });
    expect(pickerReducer(failed, { type: 'DRAW_STARTED' }).error).toBeNull();
  });

  it('waits for an explicit new draw after exhaustion and clears all private state', () => {
    const previous = pickerReducer(initialPickerState, { type: 'DRAW_COMMITTED', idea, catalog, drawId: 'draw-1' });
    expect(pickerReducer(previous, { type: 'DRAW_EXHAUSTED', catalog })).toMatchObject({ phase: 'exhausted', idea });
    expect(pickerReducer(previous, { type: 'CLEAR' })).toEqual(initialPickerState);
    expect(pickerReducer(previous, { type: 'DRAW_EMPTY', catalog })).toMatchObject({ phase: 'empty', idea: null });
  });

  it('ignores animation completion unless a result is being revealed', () => {
    const drawing = pickerReducer(initialPickerState, { type: 'DRAW_STARTED' });
    expect(pickerReducer(drawing, { type: 'REVEAL_FINISHED' })).toBe(drawing);
  });

  it('retains the current card until a reset commits, then clears it without starting a draw', () => {
    const previous = pickerReducer(initialPickerState, { type: 'DRAW_COMMITTED', idea, catalog, drawId: 'draw-1' });
    const resetting = pickerReducer(previous, { type: 'RESET_STARTED' });
    expect(resetting).toMatchObject({ phase: 'resetting', idea, error: null });
    expect(pickerReducer(resetting, { type: 'REVEAL_FINISHED' })).toBe(resetting);
    const completed = pickerReducer(resetting, { type: 'RESET_COMMITTED' });
    expect(completed).toEqual({ ...initialPickerState, phase: 'reset' });
    expect(pickerReducer(completed, { type: 'DRAW_STARTED' }).phase).toBe('drawing');
    expect(pickerReducer(completed, { type: 'CLEAR' })).toEqual(initialPickerState);
  });

  it('retains the current card if resetting fails and clears the error on retry', () => {
    const previous = pickerReducer(initialPickerState, { type: 'DRAW_COMMITTED', idea, catalog, drawId: 'draw-1' });
    const resetting = pickerReducer(previous, { type: 'RESET_STARTED' });
    const failed = pickerReducer(resetting, { type: 'RESET_FAILED', message: 'Спробуйте ще раз.' });
    expect(failed).toMatchObject({ phase: 'error', idea, drawId: 'draw-1', error: 'Спробуйте ще раз.' });
    expect(pickerReducer(failed, { type: 'RESET_STARTED' })).toMatchObject({ phase: 'resetting', idea, error: null });
  });
});
