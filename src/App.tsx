import { lazy, Suspense, useEffect, useState } from 'react';
import { MotionConfig, motion, useReducedMotion } from 'motion/react';
import { ALL_CATEGORIES } from './domain/types';
import type { AppServices } from './services/types';
import { AuthProvider } from './state/AuthContext';
import { useAuth } from './state/authState';
import { SoundProvider } from './state/SoundContext';
import { useSound } from './state/soundState';
import { useFamilyData } from './state/useFamilyData';
import { usePicker } from './state/usePicker';
import { CategoryPicker } from './components/CategoryPicker';
import { GoogleMark, Icon } from './components/Icons';
import { SpaceScene } from './components/SpaceScene';
import styles from './App.module.css';

const loadIdeaCard = () => import('./components/IdeaCard').then(module => ({ default: module.IdeaCard }));
const IdeaCard = lazy(loadIdeaCard);

export default function App({ services }: { services?: AppServices }) {
  return <AuthProvider services={services}><SoundProvider><MotionConfig reducedMotion="user"><FamilyOrbit /></MotionConfig></SoundProvider></AuthProvider>;
}

function FamilyOrbit() {
  const auth = useAuth();
  const sound = useSound();
  const family = useFamilyData(auth.user);
  const picker = usePicker(family.status === 'ready' ? auth.user?.uid ?? null : null);
  const reduceMotion = useReducedMotion();
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES);
  const categoryId = family.catalog?.categories.some(category => category.id === selectedCategory) ? selectedCategory : ALL_CATEGORIES;
  const categories = family.catalog?.categories ?? [];
  const pool = family.catalog?.ideas.filter(idea => categoryId === ALL_CATEGORIES || idea.categoryId === categoryId) ?? [];
  const seen = new Set(family.history?.seenIds ?? []);
  const remaining = pool.filter(idea => !seen.has(idea.id)).length;
  const ready = auth.status === 'signed-in' && family.status === 'ready';
  const isLoading = auth.configured && (auth.status === 'loading' || (auth.status === 'signed-in' && family.status === 'loading'));
  const showIdea = ready && picker.idea && !['drawing', 'exhausted', 'empty'].includes(picker.phase);
  const isExhausted = ready && picker.phase === 'exhausted';
  const busy = picker.busy;
  const selectedIdeaCategory = categories.find(item => item.id === picker.idea?.categoryId);
  const firstName = auth.user?.displayName?.split(' ')[0];

  useEffect(() => {
    if (picker.phase !== 'revealing') return;
    const timer = window.setTimeout(picker.finishReveal, reduceMotion ? 80 : 650);
    return () => window.clearTimeout(timer);
  }, [picker.phase, picker.finishReveal, reduceMotion]);

  function draw(reset = false) {
    sound.prepareAudio();
    // Warm the renderer while the shared draw commits; a failed preload can retry on render.
    void loadIdeaCard().catch(() => undefined);
    void picker.draw(categoryId, reset);
  }

  function changeCategory(id: string) {
    picker.clear();
    sound.prepareAudio();
    sound.play('plink');
    setSelectedCategory(id);
  }

  return <div className={styles.app}>
    <a className={styles.skipLink} href="#main">До пригоди</a>
    <div className={styles.backgroundStars} aria-hidden="true" />
    <div className={styles.pageShell}>
      <header className={styles.header}>
        <a className={styles.brand} href={import.meta.env.BASE_URL} aria-label="Сімейна орбіта — головна"><span className={styles.brandIcon}><Icon name="planet" size={27} /></span><span>сімейна<span className={styles.brandSecond}>орбіта<span className={styles.brandDot}>.</span></span></span></a>
        <div className={styles.headerActions}>
          <button type="button" className={`${styles.soundButton} ${sound.soundEnabled ? styles.soundOn : ''}`} aria-pressed={sound.soundEnabled} aria-label={sound.soundEnabled ? 'Звук: увімкнено. Вимкнути звук' : 'Звук: вимкнено. Увімкнути звук'} onClick={sound.toggleSound}><Icon name={sound.soundEnabled ? 'sound' : 'muted'} size={19} /><span>Звук {sound.soundEnabled ? 'увімкнено' : 'вимкнено'}</span></button>
          {auth.status === 'signed-in' && <><span className={styles.headerDivider} /><span className={styles.userName}>{firstName ? `Привіт, ${firstName}!` : 'Привіт, досліднику!'}</span><button type="button" className={styles.signOutButton} onClick={() => { sound.stopSounds(); void auth.signOut(); }} aria-label="Вийти з облікового запису" title="Вийти"><Icon name="logout" size={19} /></button></>}
        </div>
      </header>

      <main id="main" className={styles.main}>
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}><span className={styles.eyebrowStar}>✦</span> МАЛЕНЬКІ МОМЕНТИ. ВЕЛИКІ СПОГАДИ.</div>
          {!auth.configured ? <>
            <h1 className={styles.heroTitle}>Космодром<br /><span>готується</span><br />до запуску.</h1>
            <p className={styles.heroDescription}>Тут скоро почнуться ваші сімейні пригоди. Залишилося зовсім трішки!</p>
            <div className={styles.setupNote}><Icon name="spark" size={22} /><div><strong>Майже готові до зльоту</strong><p>Власнику застосунку потрібно завершити налаштування доступу до сімейних ідей.</p></div></div>
          </> : family.status === 'unapproved' && auth.status === 'signed-in' ? <>
            <h1 className={styles.heroTitle}>У кожної сім’ї<br />своя <span>орбіта.</span></h1>
            <p className={styles.heroDescription}>Цей космодром — для вашої сім’ї. Попросіть власника додати ваш обліковий запис до екіпажу.</p>
            <button className={styles.secondaryButton} type="button" onClick={() => void auth.signOut()}>Увійти з іншим акаунтом <Icon name="arrow" size={20} /></button>
          </> : <>
            <h1 className={styles.heroTitle}>Яка пригода<br />чекає <span className={styles.todayWord}>сьогодні?<svg viewBox="0 0 350 15" fill="none" aria-hidden="true"><path d="M3 11C90 1 204 1 345 7" stroke="currentColor" strokeWidth="5" strokeLinecap="round" /></svg></span></h1>
            <p className={styles.heroDescription}>{ready ? 'Відкладіть справи. Зберіть екіпаж. Наступна маленька пригода вже чекає на вас.' : 'Трохи магії, одна кнопка — і звичайний день перетворюється на пригоду для всієї сім’ї.'}</p>

            {ready ? <div className={styles.pickerControls}>
              <CategoryPicker categories={categories} selectedId={categoryId} disabled={busy} onChange={changeCategory} />
              {isExhausted ? <div className={styles.exhaustedMessage}><strong>Цей куточок космосу вже досліджено!</strong><p>{categoryId === ALL_CATEGORIES ? 'Ви відкрили всі ідеї. Почнімо нове коло сімейних пригод?' : 'Усі ідеї цього напрямку вже відкриті. Почнімо його спочатку?'}</p><button type="button" className={styles.launchButton} onClick={() => draw(true)}><Icon name="refresh" size={21} />Почати нове коло</button></div> : <>
                <motion.button type="button" className={styles.launchButton} disabled={busy || pool.length === 0} onClick={() => draw()} whileHover={reduceMotion || busy ? {} : { y: -3 }} whileTap={reduceMotion || busy ? {} : { scale: .97 }}><Icon name={busy ? 'planet' : 'spark'} size={23} className={busy ? styles.spinningIcon : ''} /><span>{picker.phase === 'drawing' ? 'Шукаємо пригоду…' : picker.phase === 'revealing' ? 'Ось вона, пригода!' : picker.idea ? 'Ще одну пригоду!' : 'Знайти пригоду'}</span>{!busy && <Icon name="arrow" size={22} />}</motion.button>
                <p className={styles.drawHint}>{pool.length === 0 ? 'У цьому напрямку поки немає ідей.' : <><span className={styles.hintDot} />{remaining} з {pool.length} ідей ще чекають на вас</>}</p>
              </>}
              {picker.error && <p className={styles.errorMessage} role="alert">{picker.error}</p>}
            </div> : isLoading ? <div className={styles.loadingMessage} role="status"><span className={styles.loadingDots}><i /><i /><i /></span>Готуємо ваш космодром…</div> : family.status === 'error' && auth.status === 'signed-in' ? <div className={styles.connectionError} role="alert"><p>{family.error || 'Зв’язок із космодромом перервався. Спробуймо ще раз.'}</p><button type="button" className={styles.secondaryButton} onClick={family.retry}><Icon name="refresh" size={18} /> Спробувати ще раз</button></div> : <div className={styles.loginControls}>
              <button type="button" className={styles.googleButton} onClick={() => void auth.signIn()}><GoogleMark /><span>Увійти з Google</span><Icon name="arrow" size={20} /></button>
              <p className={styles.loginHint}><Icon name="heart" size={14} /> Особистий простір для вашої сім’ї</p>
              {auth.error && <p className={styles.errorMessage} role="alert">{auth.error}</p>}
            </div>}
          </>}

          <div className={styles.heroFootnote}><span className={styles.littleAstronaut} aria-hidden="true"><svg viewBox="0 0 36 40" fill="none"><path d="M7 35V24a11 11 0 0 1 22 0v11" fill="#C8B7ED" /><circle cx="18" cy="15" r="13" fill="#F1EAD9" /><rect x="8" y="8" width="20" height="14" rx="7" fill="#6DBCB9" /><path d="M12 12h6" stroke="#D5F0E2" strokeWidth="2.5" strokeLinecap="round" /><path d="M13 29h10" stroke="#A18DCD" strokeWidth="2" /><path d="M14 32v8m8-8v8" stroke="#C8B7ED" strokeWidth="7" /></svg></span><p>Для маленьких дослідників.<br /><strong>І дорослих, які вміють дивуватися.</strong></p></div>
        </div>

        <div className={`${styles.visualStage} ${showIdea ? styles.hasIdea : ''}`} aria-busy={busy}>
          {showIdea && picker.idea ? <Suspense fallback={<div className={styles.missionLoading} role="status" aria-label="Відкриваємо пригоду"><SpaceScene compact /></div>}><IdeaCard key={picker.idea.id} idea={picker.idea} categoryName={selectedIdeaCategory?.name ?? 'Сімейна пригода'} revealing={picker.phase === 'revealing'} /></Suspense> : <SpaceScene launching={picker.phase === 'drawing'} />}
          {ready && !showIdea && <div className={styles.stageCaption}><span>{isExhausted ? '✦' : '01 / ЗАПУСК ПРИГОДИ'}</span><p>{isExhausted ? 'Попереду — нові спільні спогади' : 'Всесвіт ідей. Ваш наступний спогад.'}</p></div>}
        </div>
        <div className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">{ready && picker.phase === 'result' && picker.idea ? `Ваша пригода: ${picker.idea.markdown.replace(/[*#[\]]/g, '')}` : ready && picker.phase === 'exhausted' ? 'Усі ідеї обраного напрямку вже відкриті.' : ''}</div>
      </main>

      <section className={styles.journeyStrip} aria-label="Три кроки до пригоди">
        <div className={styles.journeyItem}><span className={`${styles.journeyIcon} ${styles.journeyMint}`}><Icon name="planet" size={24} /></span><div><span className={styles.journeyNumber}>01 / ОБИРАЄМО</span><p>Настрій для пригоди</p></div></div>
        <span className={styles.journeyConnector} aria-hidden="true">············ <Icon name="arrow" size={16} /></span>
        <div className={styles.journeyItem}><span className={`${styles.journeyIcon} ${styles.journeyYellow}`}><Icon name="spark" size={24} /></span><div><span className={styles.journeyNumber}>02 / ДИВУЄМОСЬ</span><p>Маленька мить магії</p></div></div>
        <span className={styles.journeyConnector} aria-hidden="true">············ <Icon name="arrow" size={16} /></span>
        <div className={styles.journeyItem}><span className={`${styles.journeyIcon} ${styles.journeyPink}`}><Icon name="heart" size={23} /></span><div><span className={styles.journeyNumber}>03 / РАЗОМ</span><p>Великий новий спогад</p></div></div>
      </section>
      <footer className={styles.footer}><span>Менше «що робити?». Більше «а пам’ятаєш?».</span><span className={styles.footerSignature}>створено для часу разом <Icon name="spark" size={12} /></span></footer>
    </div>
  </div>;
}
