import { parseCatalog } from '../domain/catalog';
import { selectIdea } from '../domain/selection';
import type { DrawState } from '../domain/types';
import type { AppServices, FamilySnapshot, FamilyUser } from '../services/types';

// Invented examples, loaded only by the development entry point. Never private content.
const exampleMarkdown = `# Тестова експедиція

## Творча планета
- **Пошта з іншої галактики.** Намалюйте листівку для вигаданого мешканця далекої планети. Придумайте йому ім’я та розкажіть про вашу родину.
- **Веселковий космопорт.** Побудуйте маленьку ракету з кольорових паперових фігур. Кожен додає одну деталь.

## Планета відкриттів
- **Щоденник маленької хмари.** Разом вигадайте, що сьогодні побачила хмаринка з вікна вашого дому.
- **Таємниця синього камінця.** Створіть історію про чарівний предмет, який знаходить космічна команда.

## Планета руху
- **Танець робота-прибульця.** Кожен придумує один кумедний рух, а вся команда повторює.

## Планета смаколиків
- **Меню для марсіанина.** Намалюйте незвичайний сніданок для доброго прибульця.

## Планета історій
- **Загублена зірочка.** Складіть казку: по одному реченню від кожного члена команди.

## Планета дружби
- **Космічний комплімент.** Придумайте добрі суперздібності для кожного члена команди.

## Планета уяви
- **Карта місячного міста.** Разом намалюйте місто з незвичайними будинками й назвіть його вулиці.

## Планета усмішок
- **Інтерв’ю з кометою.** По черзі ставте кумедні запитання вигаданій гості з космосу.
`;

export function createDemoServices(): AppServices {
  const scenario = new URLSearchParams(window.location.search).get('scenario');
  const catalog = parseCatalog({ markdown: scenario === 'empty' ? '# Порожньо' : exampleMarkdown, excludedSections: [] });
  const demoUser: FamilyUser = { uid: 'demo-adult', displayName: 'Капітан', email: null, photoURL: null };
  let user: FamilyUser | null = scenario === 'signed-out' ? null : demoUser;
  let history: DrawState = { seenIds: [], lastIdeaId: null };
  const authListeners = new Set<(user: FamilyUser | null) => void>();
  const familyListeners = new Set<(snapshot: FamilySnapshot) => void>();
  const snapshot = (): FamilySnapshot => ({
    status: scenario === 'unapproved' ? 'unapproved' : 'ready',
    catalog: scenario === 'unapproved' ? null : catalog,
    history: scenario === 'unapproved' ? null : history,
  });
  return {
    configured: true,
    subscribeAuth(next) { authListeners.add(next); next(user); return () => { authListeners.delete(next); }; },
    async signIn() { user = demoUser; authListeners.forEach((listener) => listener(user)); },
    async signOut() { user = null; authListeners.forEach((listener) => listener(null)); },
    subscribeFamily(_userId, next) { familyListeners.add(next); next(snapshot()); return () => { familyListeners.delete(next); }; },
    async drawIdea(categoryId, reset) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      if (scenario === 'error') throw new Error('Тестова помилка з’єднання');
      const result = selectIdea(catalog, history, categoryId, reset);
      if (result.kind !== 'drawn') return result;
      history = result.state;
      familyListeners.forEach((listener) => listener(snapshot()));
      return { ...result, drawId: crypto.randomUUID() };
    },
  };
}
