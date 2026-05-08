const LOCK_COUNT_ATTR = "data-body-scroll-lock-count";
const PREV_OVERFLOW_ATTR = "data-body-scroll-lock-prev-overflow";

function getLockCount(body: HTMLElement): number {
  const value = body.getAttribute(LOCK_COUNT_ATTR);
  if (!value) return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function lockBodyScroll(): () => void {
  const body = document.body;
  const currentCount = getLockCount(body);

  if (currentCount === 0) {
    body.setAttribute(PREV_OVERFLOW_ATTR, body.style.overflow);
    body.style.overflow = "hidden";
  }

  body.setAttribute(LOCK_COUNT_ATTR, String(currentCount + 1));

  let unlocked = false;
  return () => {
    if (unlocked) return;
    unlocked = true;

    const nextCount = Math.max(0, getLockCount(body) - 1);
    if (nextCount === 0) {
      const previousOverflow = body.getAttribute(PREV_OVERFLOW_ATTR) ?? "";
      body.style.overflow = previousOverflow;
      body.removeAttribute(LOCK_COUNT_ATTR);
      body.removeAttribute(PREV_OVERFLOW_ATTR);
      return;
    }

    body.setAttribute(LOCK_COUNT_ATTR, String(nextCount));
  };
}
