export function errorMessage(error: unknown, fallback: string): string {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : '';

  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Вхід скасовано. Натисніть кнопку, коли будете готові.';
    case 'auth/popup-blocked':
      return 'Браузер заблокував вікно входу. Дозвольте спливні вікна для цього сайту й спробуйте ще раз.';
    case 'auth/unauthorized-domain':
      return 'Адресу цього сайту ще не додано до дозволених адрес входу.';
    case 'auth/network-request-failed':
    case 'unavailable':
      return 'Немає зв’язку. Перевірте інтернет і спробуйте ще раз.';
    case 'permission-denied':
      return 'Доступ до сімейних пригод поки не надано. Попросіть адміністратора родини перевірити ваш обліковий запис.';
    default:
      return fallback;
  }
}
