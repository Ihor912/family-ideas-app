import { useEffect, useRef } from 'react';
import type { Category } from '../domain/types';
import { ALL_CATEGORIES } from '../domain/types';
import { Icon } from './Icons';
import styles from '../App.module.css';

const decorativeSymbols = ['✦', '♡', '✿', '◇', '▦', 'ϟ', '♧', '⌁', '⌂'];

function categoryPresentation(category?: Category, index = 0) {
  return { label: category?.name ?? 'Усі пригоди', symbol: decorativeSymbols[index % decorativeSymbols.length] };
}

export function CategoryPicker({ categories, selectedId, disabled, onChange }: { categories: Category[]; selectedId: string; disabled: boolean; onChange: (id: string) => void }) {
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (disabled) details.current?.removeAttribute('open');
  }, [disabled]);
  const selected = categories.find(category => category.id === selectedId);
  const selectedLook = categoryPresentation(selected, categories.findIndex(category => category.id === selectedId) + 1);
  const options = [{ id: ALL_CATEGORIES, name: 'Усі пригоди', count: 0 }, ...categories];
  return <details ref={details} className={styles.categoryPicker} onKeyDown={event => { if (event.key === 'Escape') { details.current?.removeAttribute('open'); details.current?.querySelector('summary')?.focus(); } }}>
    <summary className={styles.categoryTrigger} onClick={event => { if (disabled) event.preventDefault(); }} aria-disabled={disabled}>
      <span className={styles.categoryOrb} aria-hidden="true">{selectedLook.symbol}</span>
      <span><span className={styles.controlEyebrow}>Куди хочеться?</span><span className={styles.selectedCategory}>{selectedLook.label}</span></span>
      <Icon name="chevron" size={18} className={styles.categoryChevron} />
    </summary>
    <div className={styles.categoryMenu}>
      <div className={styles.categoryMenuHeading}><span>Обираємо напрямок</span><button type="button" className={styles.smallIconButton} aria-label="Закрити вибір категорії" onClick={() => { details.current?.removeAttribute('open'); details.current?.querySelector('summary')?.focus(); }}><Icon name="close" size={18} /></button></div>
      <fieldset className={styles.categoryGrid} disabled={disabled}>
        <legend className={styles.srOnly}>Категорія пригоди</legend>
        {options.map((category, index) => {
          const look = categoryPresentation(index === 0 ? undefined : category, index);
          return <label key={category.id} className={`${styles.categoryOption} ${category.id === selectedId ? styles.categorySelected : ''}`}>
            <input type="radio" name="adventure-category" value={category.id} checked={category.id === selectedId} onChange={() => { onChange(category.id); details.current?.removeAttribute('open'); details.current?.querySelector('summary')?.focus(); }} />
            <span className={styles.categorySymbol} data-color={index % 4} aria-hidden="true">{look.symbol}</span>
            <span>{look.label}</span>
            {category.id === selectedId && <Icon name="check" size={15} className={styles.categoryCheck} />}
          </label>;
        })}
      </fieldset>
    </div>
  </details>;
}
