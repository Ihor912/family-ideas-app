import { motion, useReducedMotion } from 'motion/react';
import type { CSSProperties } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Idea } from '../domain/types';
import { Icon } from './Icons';
import styles from '../App.module.css';

export function IdeaCard({ idea, categoryName, revealing }: { idea: Idea; categoryName: string; revealing: boolean }) {
  const reduceMotion = useReducedMotion();
  return <motion.div className={styles.missionWrap} initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 25, rotate: -3, scale: .94 }} animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 180, damping: 18 }}>
    {revealing && !reduceMotion && <div className={styles.confetti} aria-hidden="true">{Array.from({ length: 14 }, (_, index) => <i key={index} style={{ '--piece': index, '--rotation': `${index * 51}deg`, '--distance': `${130 + (index % 4) * 35}px` } as CSSProperties} />)}</div>}
    <div className={styles.missionOrbit} aria-hidden="true" />
    <div className={styles.missionSticker} aria-hidden="true">знайшли<br /><span>пригоду!</span><Icon name="spark" size={18} /></div>
    <article className={styles.missionCard}>
      <div className={styles.missionTopline}><span><span className={styles.statusDot} /> СІМЕЙНА МІСІЯ</span><Icon name="planet" size={25} /></div>
      <div className={styles.missionCategory}>{categoryName}</div>
      <div className={styles.ideaMarkdown}>
        <ReactMarkdown skipHtml disallowedElements={['img']} urlTransform={url => {
          try { return new URL(url).protocol === 'https:' ? url : ''; } catch { return ''; }
        }} components={{ a: ({ href, children }) => href ? <a href={href} target="_blank" rel="noopener noreferrer">{typeof children === 'string' && children.startsWith('https://') ? 'Переглянути місце ↗' : children}</a> : <span>{children}</span> }}>{idea.markdown}</ReactMarkdown>
      </div>
      <div className={styles.missionFooter}><Icon name="heart" size={17} /><span>Головне — зробити це разом.</span></div>
    </article>
    <span className={styles.cardTinyStar} aria-hidden="true">✦</span>
  </motion.div>;
}
