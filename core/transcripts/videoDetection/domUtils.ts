export function isElementVisible(element: Element | null): boolean {
  if (!element) return false;
  if (element.hasAttribute('hidden')) return false;
  if (element.closest('[hidden]')) return false;
  if (element.getAttribute('aria-hidden') === 'true') return false;
  if (element.closest('[aria-hidden="true"]')) return false;

  const details = element.closest('details');
  if (details && !details.hasAttribute('open')) {
    const summary = element.closest('summary');
    if (!summary || summary.parentElement !== details) {
      return false;
    }
  }

  const inlineStyle = (element as HTMLElement).style;
  if (inlineStyle) {
    if (inlineStyle.display === 'none') return false;
    if (inlineStyle.visibility === 'hidden' || inlineStyle.visibility === 'collapse') return false;
    const opacity = Number.parseFloat(inlineStyle.opacity || '1');
    if (Number.isFinite(opacity) && opacity <= 0) return false;
  }

  const view = element.ownerDocument?.defaultView;
  if (view && typeof view.getComputedStyle === 'function') {
    const style = view.getComputedStyle(element);
    if (style) {
      if (style.display === 'none') return false;
      if (style.visibility === 'hidden' || style.visibility === 'collapse') return false;
      const opacity = Number.parseFloat(style.opacity || '1');
      if (Number.isFinite(opacity) && opacity <= 0) return false;
    }
  }

  return true;
}
