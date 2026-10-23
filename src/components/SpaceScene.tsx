import { motion, useReducedMotion } from 'motion/react';
import styles from '../App.module.css';

export function SpaceScene({ launching = false, compact = false }: { launching?: boolean; compact?: boolean }) {
  const reduceMotion = useReducedMotion();
  return <div className={`${styles.spaceScene} ${compact ? styles.sceneCompact : ''}`} aria-hidden="true">
    <div className={styles.sceneGlow} />
    <svg className={styles.orbitArtwork} viewBox="0 0 600 580" fill="none">
      <circle cx="302" cy="286" r="204" stroke="#BBC7EE" strokeOpacity=".13" />
      <circle cx="302" cy="286" r="265" stroke="#BBC7EE" strokeOpacity=".10" strokeDasharray="3 12" />
      <ellipse cx="303" cy="285" rx="279" ry="116" transform="rotate(-34 303 285)" stroke="#BBC7EE" strokeOpacity=".2" />
      <path d="m70 158 4-11 4 11 11 4-11 4-4 11-4-11-11-4 11-4Z" fill="#FAD66D" />
      <path d="m480 397 3-9 3 9 9 3-9 3-3 9-3-9-9-3 9-3Z" fill="#FAD66D" />
      <path d="m491 157 3-8 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" fill="#B3A0F6" />
      <circle cx="196" cy="70" r="3" fill="#8EDCCC" />
      <circle cx="511" cy="286" r="3" fill="#E6E4FF" />
      <circle cx="127" cy="415" r="3" fill="#B3A0F6" />
      <circle cx="325" cy="526" r="2" fill="#8EDCCC" />
      <g transform="translate(460 84) rotate(-22)">
        <circle r="32" fill="#F8C96E" />
        <path d="M-27-16a32 32 0 0 1 54 0c-17 9-37 9-54 0Z" fill="#FFDD91" />
        <path d="M-29 14c17 8 38 8 57-1" stroke="#E6A455" strokeWidth="7" strokeLinecap="round" />
        <ellipse rx="54" ry="12" stroke="#F0B477" strokeWidth="7" />
        <path d="M-27-16a32 32 0 0 1 54 0L26-2c-16 7-36 8-53 0Z" fill="#F8C96E" />
      </g>
      <g transform="translate(100 357)">
        <circle r="25" fill="#C5B5F1" /><path d="M-4-24c-12 15-8 35 9 48A25 25 0 0 1-4-24Z" fill="#A48CDB" />
        <circle cx="8" cy="-9" r="5" fill="#AF97E2" /><circle cx="14" cy="9" r="3" fill="#AF97E2" /><circle cx="-5" cy="6" r="6" fill="#AF97E2" />
      </g>
      <circle cx="421" cy="474" r="9" fill="#77C9C3" /><circle cx="418" cy="471" r="3" fill="#ADE5D7" />
    </svg>
    <motion.svg className={styles.rocketArtwork} viewBox="0 0 420 460" fill="none" animate={reduceMotion ? {} : launching ? { y: [-3, -12, -3], rotate: [0, -2, 2, 0] } : { y: [0, -12, 0], rotate: [-1, 1, -1] }} transition={{ duration: launching ? .38 : 5, repeat: Infinity, ease: 'easeInOut' }}>
      <defs>
        <linearGradient id="rocket-body" x1="126" y1="180" x2="285" y2="180" gradientUnits="userSpaceOnUse"><stop stopColor="#FFF8E9" /><stop offset=".68" stopColor="#FFFDF7" /><stop offset="1" stopColor="#DCE7E5" /></linearGradient>
        <linearGradient id="rocket-window" x1="176" y1="150" x2="238" y2="218" gradientUnits="userSpaceOnUse"><stop stopColor="#75D8D2" /><stop offset="1" stopColor="#367A9C" /></linearGradient>
        <linearGradient id="rocket-flame" x1="211" y1="323" x2="211" y2="440" gradientUnits="userSpaceOnUse"><stop stopColor="#FFB66D" /><stop offset="1" stopColor="#FFB66D" stopOpacity="0" /></linearGradient>
      </defs>
      <g transform="rotate(25 210 230)">
        <motion.g animate={reduceMotion ? {} : { scaleY: launching ? [1, 1.6, 1] : [1, .83, 1] }} transition={{ duration: launching ? .2 : .7, repeat: Infinity }} style={{ transformOrigin: '210px 320px' }}>
          <path d="M174 322c-2 36 12 83 36 117 27-36 40-81 36-117Z" fill="url(#rocket-flame)" />
          <path d="M186 324c-1 27 7 50 24 73 18-24 26-50 24-73Z" fill="#FFE5A2" />
          <path d="M197 323c0 17 4 27 13 40 9-13 13-26 13-40Z" fill="#FFFBEA" />
        </motion.g>
        <path d="M147 224c-35 17-55 49-54 101l47-20 20-50-13-31Z" fill="#E98983" />
        <path d="M273 224c35 17 55 49 54 101l-47-20-20-50 13-31Z" fill="#D97B78" />
        <path d="m93 325 47-20 9-24c-26 6-42 20-56 44Z" fill="#C76B72" />
        <path d="m327 325-47-20-9-24c26 6 42 20 56 44Z" fill="#BC656D" />
        <path d="M210 44c-51 40-80 103-80 177 0 39 10 72 24 95h112c14-23 24-56 24-95 0-74-29-137-80-177Z" fill="url(#rocket-body)" />
        <path d="M210 44c-29 23-51 54-65 91 43 13 88 13 131 0-15-37-37-68-66-91Z" fill="#F2978C" />
        <path d="M210 44c-16 21-27 45-33 74l-27 4c14-31 34-58 60-78Z" fill="#FFB2A1" />
        <path d="M151 306h118l-7 22H158l-7-22Z" fill="#7ABDB9" />
        <path d="M162 328h96l-5 13h-86l-5-13Z" fill="#386F81" />
        <circle cx="210" cy="198" r="48" fill="#E5C295" />
        <circle cx="210" cy="198" r="39" fill="url(#rocket-window)" stroke="#FFF9E7" strokeWidth="5" />
        <path d="M185 190a27 27 0 0 1 20-18" stroke="#C9F8EA" strokeWidth="7" strokeLinecap="round" />
        <circle cx="227" cy="213" r="5" fill="#D0EEE3" fillOpacity=".4" />
        <path d="M210 262c-14 15-18 39-14 65l14 20 14-20c4-26 0-50-14-65Z" fill="#EF9589" />
        <path d="M210 262v85l14-20c4-26 0-50-14-65Z" fill="#D97A78" />
        <circle cx="171" cy="261" r="3" fill="#D0D8CC" /><circle cx="249" cy="261" r="3" fill="#D0D8CC" />
      </g>
    </motion.svg>
    <div className={styles.orbitLabel}><span /> курс на гарний день</div>
    {!launching && <div className={styles.sceneNote}><span className={styles.noteStar}>✦</span><span>Найкращі пригоди —<br /><strong>ті, що разом.</strong></span></div>}
  </div>;
}
