import { useLayoutEffect, useState, type RefObject } from 'react';

const MOBILE_MQ = '(max-width: 767px)';
const DESKTOP_DEFAULT = 4;
const MOBILE_MIN = 4;
const MOBILE_MAX = 40;
const GRID_COLS = 2;
const DEFAULT_ROW_HEIGHT = 56;

function measureRowHeight(container: HTMLElement): number {
  const card = container.querySelector('.category-section__grid .module-card');
  if (!card) return DEFAULT_ROW_HEIGHT;
  const grid = card.closest('.category-section__grid');
  const gap = grid ? parseFloat(getComputedStyle(grid).gap) || 4 : 4;
  return card.getBoundingClientRect().height + gap;
}

/**
 * How many module cards fit in the visible category grid on mobile before "Show more".
 * Measures the scroll container and subtracts headers, footers, and level chrome.
 */
export function measureCategoryGridCapacity(container: HTMLElement): number {
  const containerHeight = container.clientHeight;
  if (containerHeight <= 0) return 8;

  const sections = container.querySelectorAll('.category-section');
  let occupied = 0;

  const containerStyle = getComputedStyle(container);
  occupied += parseFloat(containerStyle.paddingTop) + parseFloat(containerStyle.paddingBottom);
  const sectionGap = parseFloat(containerStyle.gap) || 4;

  let expandedSection: Element | null = null;

  for (const section of sections) {
    const header = section.querySelector('.category-section__header');
    if (header) {
      occupied += header.getBoundingClientRect().height;
      if (header.classList.contains('category-section__header--expanded')) {
        expandedSection = section;
      }
    }
  }

  if (sections.length > 1) {
    occupied += (sections.length - 1) * sectionGap;
  }

  if (!expandedSection) {
    return 8;
  }

  const body = expandedSection.querySelector('.category-section__body');
  if (!body) return 8;

  let bodyChrome = 0;
  const bodyStyle = getComputedStyle(body);
  bodyChrome += parseFloat(bodyStyle.paddingTop) + parseFloat(bodyStyle.paddingBottom);

  const level = body.querySelector('.category-section__level');
  if (level) {
    const levelStyle = getComputedStyle(level);
    const levelGap = parseFloat(levelStyle.gap) || 2;
    const tag = level.querySelector('.category-section__level-tag');
    const hidden = body.querySelector('.category-section__levels-hidden');

    if (tag) bodyChrome += tag.getBoundingClientRect().height + levelGap;
    // Omit "show more" — capacity targets filling the pane; extra rows may hide this control.
    if (hidden) bodyChrome += hidden.getBoundingClientRect().height;
  }

  let gridAvailable = containerHeight - occupied - bodyChrome;

  // Slack below the last category row (safe-area / outer padding not in clientHeight).
  const lastSection = sections[sections.length - 1];
  if (lastSection) {
    const vvHeight = window.visualViewport?.height ?? window.innerHeight;
    const slackBelow = vvHeight - lastSection.getBoundingClientRect().bottom;
    if (slackBelow > 0) {
      gridAvailable += slackBelow;
    }
  }

  const rowHeight = measureRowHeight(container);
  const rows = Math.max(1, Math.ceil(gridAvailable / rowHeight));

  return Math.max(MOBILE_MIN, Math.min(rows * GRID_COLS, MOBILE_MAX));
}

/**
 * Desktop: fixed default. Mobile: dynamic fit based on `.main-menu__categories` height.
 */
export function useMobileCategoryGridCapacity(
  categoriesRef: RefObject<HTMLDivElement | null>,
  enabled: boolean,
  layoutKey: string
): number {
  const [count, setCount] = useState(DESKTOP_DEFAULT);

  useLayoutEffect(() => {
    if (!enabled) {
      setCount(DESKTOP_DEFAULT);
      return;
    }

    const mq = window.matchMedia(MOBILE_MQ);
    let rafId = 0;
    let ro: ResizeObserver;

    const recompute = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (!mq.matches) {
          setCount(DESKTOP_DEFAULT);
          return;
        }
        const el = categoriesRef.current;
        if (!el) return;
        setCount(measureCategoryGridCapacity(el));
      });
    };

    const bindObservers = () => {
      ro.disconnect();
      const el = categoriesRef.current;
      if (!el) return;
      ro.observe(el);
      el.querySelectorAll('.category-section__body').forEach(body => ro.observe(body));
    };

    ro = new ResizeObserver(() => {
      recompute();
      bindObservers();
    });

    recompute();
    bindObservers();

    mq.addEventListener('change', recompute);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', recompute);

    // Second pass after layout settles (card count affects row height).
    const settleId = window.setTimeout(recompute, 120);

    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(settleId);
      ro.disconnect();
      mq.removeEventListener('change', recompute);
      vv?.removeEventListener('resize', recompute);
    };
  }, [categoriesRef, enabled, layoutKey]);

  return count;
}
