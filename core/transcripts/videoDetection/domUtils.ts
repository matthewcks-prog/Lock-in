function isHiddenByAttributes(element: Element): boolean {
  if (element.hasAttribute('hidden')) return true;
  if (element.closest('[hidden]')) return true;
  if (element.getAttribute('aria-hidden') === 'true') return true;
  if (element.closest('[aria-hidden="true"]')) return true;
  return false;
}

function isHiddenByDetails(element: Element): boolean {
  const details = element.closest('details');
  if (!details || details.hasAttribute('open')) {
    return false;
  }
  const summary = element.closest('summary');
  return !summary || summary.parentElement !== details;
}

function isHiddenByStyle(style: CSSStyleDeclaration | null): boolean {
  if (!style) return false;
  if (style.display === 'none') return true;
  if (style.visibility === 'hidden' || style.visibility === 'collapse') return true;
  const opacity = Number.parseFloat(style.opacity || '1');
  return Number.isFinite(opacity) && opacity <= 0;
}

function isHiddenByInlineStyle(element: Element): boolean {
  return isHiddenByStyle((element as HTMLElement).style);
}

function isHiddenByComputedStyle(element: Element): boolean {
  const view = element.ownerDocument?.defaultView;
  if (!view || typeof view.getComputedStyle !== 'function') return false;
  const style = view.getComputedStyle(element);
  return isHiddenByStyle(style);
}

export function isElementVisible(element: Element | null): boolean {
  if (!element) return false;
  if (isHiddenByAttributes(element)) return false;
  if (isHiddenByDetails(element)) return false;
  if (isHiddenByInlineStyle(element)) return false;
  if (isHiddenByComputedStyle(element)) return false;
  return true;
}
