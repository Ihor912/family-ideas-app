import { useEffect, useId, useRef } from 'react';
import { Icon } from './Icons';
import styles from '../App.module.css';

type Props = {
  open: boolean;
  busy: boolean;
  canReset: boolean;
  categoryName: string | null;
  onRequest: () => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ResetHistory({ open, busy, canReset, categoryName, onRequest, onCancel, onConfirm }: Props) {
  const titleId = useId();
  const descriptionId = useId();
  const panelId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) cancel.current?.focus();
  }, [open]);

  function dismiss() {
    onCancel();
    trigger.current?.focus();
  }

  return <div className={styles.resetHistory}>
    <button ref={trigger} type="button" className={styles.resetButton} disabled={busy || !canReset}
      aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={onRequest}>
      <Icon name="refresh" size={16} /> Скинути історію
    </button>
    {open && <div id={panelId} className={styles.resetPanel} role="group" aria-labelledby={titleId}
      aria-describedby={descriptionId} onKeyDown={event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          dismiss();
        }
      }}>
      <h2 id={titleId}>Почати нове коло?</h2>
      <p id={descriptionId}>{categoryName
        ? <>Пригоди категорії «{categoryName}» знову стануть доступними для всієї родини. Історія інших категорій збережеться.</>
        : 'Усі пригоди знову стануть доступними для всієї родини на всіх пристроях.'}</p>
      <div className={styles.resetActions}>
        <button ref={cancel} type="button" className={styles.resetCancel} onClick={dismiss}>Залишити історію</button>
        <button type="button" className={styles.resetConfirm} onClick={onConfirm}>Так, скинути</button>
      </div>
    </div>}
  </div>;
}
