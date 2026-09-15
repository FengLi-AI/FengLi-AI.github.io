const $ = (s, root = document) => root.querySelector(s);
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const mobile = matchMedia('(max-width: 760px), (hover: none) and (pointer: coarse)');
const safeURL = (value, base = location.href) => {
  const url = new URL(value, base);
  if (!['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)) throw new Error('Unsupported link');
  return url.href;
};
const readJSON = async (file) => {
  const response = await fetch(file, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${file}: ${response.status}`);
  return response.json();
};
function externalLink(a, href) {
  a.href = safeURL(href);
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
}
function resumeLink(path) {
  const a = document.createElement('a');
  const url = new URL(path, location.href);
  // Local previews may open their bundled companion PDF from the file system.
  if (!['http:', 'https:'].includes(url.protocol) && !(location.protocol === 'file:' && url.protocol === 'file:' && url.pathname.toLowerCase().endsWith('.pdf'))) throw new Error('Unsupported resume link');
  a.href = url.href; a.target = '_blank'; a.rel = 'noopener noreferrer';
  a.textContent = '我的简历 ↗'; a.setAttribute('aria-label', '打开我的 PDF 简历（新窗口）');
  return a;
}
readJSON('content/profile.json').then(profile => {
  $('[data-profile="intro"]').textContent = profile.intro;
  $('[data-profile="name"]').textContent = profile.name;
  const phone = $('[data-profile="phone"]');
  phone.textContent = profile.phone.replace(/^(\d{3})(\d{4})(\d{4})$/, '$1 $2 $3'); phone.href = `tel:${profile.phone.replace(/[^+\d]/g, '')}`;
  const email = $('[data-profile="email"]');
  email.textContent = profile.email; email.href = `mailto:${profile.email}`;
  $('[data-profile="wechat"]').textContent = profile.wechat;
  $('.brand').textContent = `${profile.englishName} / ${profile.name}`;
  $('#about-title').replaceChildren(document.createTextNode(`${profile.englishName}.`), document.createElement('br'), document.createTextNode(`${profile.name}。`));
  $('.contact-foot span').textContent = `${profile.englishName} / ${profile.name}`;
  $('.profile-links').replaceChildren(resumeLink(profile.resume), ...profile.links.map(link => {
    const a = document.createElement('a'); a.textContent = `${link.label} ↗`; externalLink(a, link.url); return a;
  }));
  window.dispatchEvent(new Event('site:layout'));
}).catch(error => console.warn('Profile fallback retained:', error));

const section = $('#experience');
const overview = $('.experience-overview');
const reader = $('.reader');
const title = $('.reader-title');
const content = $('.reader-content');
const close = $('.reader-close');
let selected = null, busy = false, controller = null;
let sourceLabel = null;
const settle = (animation) => animation.finished.catch(() => {});
function animate(el, frames, duration, delay = 0) {
  return el.animate(frames, {duration: motion.matches ? 0 : duration, delay: motion.matches ? 0 : delay, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both'});
}
async function loadMarkdown(button) {
  controller?.abort(); controller = new AbortController();
  content.textContent = '正在展开内容…'; content.setAttribute('aria-busy', 'true');
  try {
    const url = new URL(button.dataset.file, location.href);
    const response = await fetch(url, {cache: 'no-cache', signal: controller.signal});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const md = await response.text();
    if (selected !== button) return;
    content.innerHTML = DOMPurify.sanitize(marked.parse(md), {USE_PROFILES: {html: true}, FORBID_TAGS: ['style', 'form', 'input', 'button', 'iframe'], FORBID_ATTR: ['style']});
    content.querySelectorAll('a[href]').forEach(a => {
      try { externalLink(a, safeURL(a.getAttribute('href'), url)); } catch { a.removeAttribute('href'); }
    });
    content.querySelectorAll('img').forEach(img => {
      try { img.src = safeURL(img.getAttribute('src'), url); } catch { img.remove(); }
      img.loading = 'lazy'; img.addEventListener('load', () => window.dispatchEvent(new Event('site:layout')), {once: true});
    });
    content.querySelectorAll('table').forEach(table => {
      const wrapper = document.createElement('div'); wrapper.className = 'table-wrap'; wrapper.tabIndex = 0; wrapper.setAttribute('role', 'region'); wrapper.setAttribute('aria-label', '内容表格');
      table.replaceWith(wrapper); wrapper.append(table);
    });
  } catch (error) {
    if (error.name === 'AbortError' || selected !== button) return;
    content.replaceChildren();
    const p = document.createElement('p'); p.textContent = '这段内容暂时没有打开，请重试。';
    const retry = document.createElement('button'); retry.textContent = '重新加载'; retry.onclick = () => loadMarkdown(button);
    content.append(p, retry);
  } finally {
    if (selected === button) { content.removeAttribute('aria-busy'); window.dispatchEvent(new Event('site:layout')); }
  }
}
async function openReader(button) {
  if (busy || selected) return;
  busy = true; selected = button;
  // Start the reading scene at a stable position, retaining the user's selected row.
  window.scrollTo({top: section.offsetTop, behavior: 'instant'});
  const labelRect = $('strong', button).getBoundingClientRect();
  const rowRect = button.getBoundingClientRect();
  sourceLabel = {x: labelRect.x, y: labelRect.y, width: labelRect.width};
  overview.inert = true;
  overview.setAttribute('aria-hidden', 'true'); button.setAttribute('aria-expanded', 'true');
  reader.hidden = false; title.textContent = $('strong', button).textContent;
  content.scrollTop = 0;
  window.siteReading = true;
  document.documentElement.classList.add('reading-locked');
  section.classList.add('is-reading'); document.body.classList.add('reading-experience');
  window.dispatchEvent(new Event('site:layout'));
  const destination = title.getBoundingClientRect();
  const panelRect = reader.getBoundingClientRect();
  const top = Math.max(0, rowRect.top - panelRect.top);
  const bottom = Math.max(0, panelRect.bottom - rowRect.bottom);
  const background = animate($('.reader-surface'), [{clipPath: `inset(${top}px 0 ${bottom}px 0)`}, {clipPath: 'inset(0px 0 0px 0)'}], 620, 100);
  const flight = animate(title, [{transform: `translate(${sourceLabel.x-destination.x}px,${sourceLabel.y-destination.y}px) scale(${sourceLabel.width / Math.max(1, destination.width)})`}, {transform: 'translate(0,0) scale(1)'}], 680, 80);
  const reveal = animate(content, [{opacity: 0, transform: 'translateY(20px)'}, {opacity: 1, transform: 'translateY(0)'}], 420, 330);
  const control = animate(close, [{opacity: 0}, {opacity: 1}], 220, 450);
  loadMarkdown(button);
  await Promise.all([background, flight, reveal, control].map(settle));
  [background, flight, reveal, control].forEach(a => a.cancel());
  busy = false; close.focus({preventScroll: true});
}
async function closeReader() {
  if (!selected || busy) return;
  busy = true; controller?.abort();
  window.scrollTo({top: section.offsetTop, behavior: 'instant'});
  const fade = animate(reader, [{opacity: 1, transform: 'translateY(0)'}, {opacity: 0, transform: 'translateY(12px)'}], 230);
  await settle(fade); fade.cancel();
  reader.hidden = true; section.classList.remove('is-reading'); document.body.classList.remove('reading-experience');
  document.documentElement.classList.remove('reading-locked');
  overview.inert = false; overview.removeAttribute('aria-hidden');
  selected.setAttribute('aria-expanded', 'false');
  const last = selected; selected = null; busy = false; window.siteReading = false;
  window.dispatchEvent(new Event('site:layout'));
  window.scrollTo({top: section.offsetTop, behavior: 'instant'}); last.focus({preventScroll: true});
}
document.querySelectorAll('.experience-row').forEach(button => button.addEventListener('click', () => openReader(button)));
close.addEventListener('click', closeReader);
section.addEventListener('keydown', e => { if (e.key === 'Escape' && selected) {e.preventDefault(); closeReader();} });
// Keep reading gestures inside the left column, including at its top and bottom.
content.addEventListener('wheel', e => e.stopPropagation(), {passive: true});
content.addEventListener('touchmove', e => e.stopPropagation(), {passive: true});
section.addEventListener('keydown', e => {
  if (!selected || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
  const delta = {ArrowDown: 44, ArrowUp: -44, PageDown: content.clientHeight * .8, PageUp: -content.clientHeight * .8}[e.key];
  if (delta !== undefined) { e.preventDefault(); content.scrollBy({top: delta, behavior: 'instant'}); }
});
// Closing before a chapter jump avoids a layout shift after the anchor is measured.
document.querySelectorAll('.chapter-nav a, .brand').forEach(a => a.addEventListener('click', async e => {
  if (!selected) return;
  e.preventDefault(); if (busy) return;
  await closeReader();
  const target = document.querySelector(a.getAttribute('href'));
  target?.scrollIntoView({behavior: motion.matches ? 'instant' : 'smooth'});
  history.replaceState(null, '', a.getAttribute('href'));
}));

const viewport = $('.work-viewport');
const track = $('.work-track');
const carousel = $('.work-carousel');
const pauseButton = $('[data-carousel="pause"]');
let count = 0, span = 0, precise = 0, written = 0, userPaused = false, hovered = false, focused = false, visible = false;
let lastTime = 0, animationID = 0, touching = false, resumeAt = 0, resumeTimer = 0;
function makeTile(item, duplicate) {
  const a = document.createElement('a'); a.className = 'work-tile'; externalLink(a, item.url);
  if (duplicate) { a.tabIndex = -1; a.setAttribute('aria-hidden', 'true'); }
  const img = document.createElement('img'); img.src = safeURL(item.image); img.alt = item.alt || item.title; img.loading = 'eager'; img.width = 720; img.height = 360;
  let media = img;
  if (item.desktopBackground) {
    media = document.createElement('div'); media.className = 'work-media desktop-preview';
    const backdrop = document.createElement('img'); backdrop.src = safeURL(item.desktopBackground);
    backdrop.className = 'work-desktop-background'; backdrop.alt = ''; backdrop.setAttribute('aria-hidden', 'true');
    img.className = 'work-product-shot';
    media.append(backdrop, img);
  }
  const body = document.createElement('div'); body.className = 'tile-copy';
  const type = document.createElement('span'); type.className = 'tile-type'; type.textContent = item.type;
  const h = document.createElement('h3'); h.textContent = item.title;
  const p = document.createElement('p'); p.textContent = item.description;
  const link = document.createElement('span'); link.className = 'tile-link';
  const label = document.createElement('span'); label.textContent = item.linkLabel || (item.type === 'ARTICLE' ? '阅读全文' : '查看项目');
  const arrow = document.createElement('span'); arrow.textContent = '↗'; link.append(label, arrow);
  body.append(type, h, p, link); a.append(media, body); return a;
}
function resizeCards() {
  if (!count) return;
  const oldSpan = span;
  const fraction = oldSpan ? (viewport.scrollLeft % oldSpan) / oldSpan : 0;
  const width = mobile.matches ? Math.min(330, viewport.clientWidth * .82) : Math.max(210, Math.min(340, (viewport.clientWidth - 22) / 2));
  carousel.style.setProperty('--card-width', `${width}px`);
  span = count * (width + 14);
  viewport.scrollLeft = span + span * fraction;
  precise = viewport.scrollLeft; written = precise;
}
function canRun() { return count > 1 && visible && !document.hidden && !motion.matches && !userPaused && !hovered && !focused && !touching && performance.now() >= resumeAt; }
function frame(now) {
  animationID = 0;
  if (!canRun()) {lastTime = 0; return;}
  const elapsed = lastTime ? Math.min(50, now-lastTime) : 0; lastTime = now;
  if (Math.abs(viewport.scrollLeft-written) > 1) precise = viewport.scrollLeft;
  precise += elapsed * (mobile.matches ? .022 : .028);
  if (precise >= span*2) precise -= span;
  viewport.scrollLeft = precise; written = viewport.scrollLeft;
  animationID = requestAnimationFrame(frame);
}
function syncRun() {
  if (canRun() && !animationID) {lastTime = 0; animationID = requestAnimationFrame(frame);}
  else if (!canRun()) {cancelAnimationFrame(animationID); animationID = 0; lastTime = 0;}
}
viewport.addEventListener('scroll', () => {
  if (!span) return;
  if (viewport.scrollLeft < span*.15) viewport.scrollLeft += span;
  else if (viewport.scrollLeft > span*2.85) viewport.scrollLeft -= span;
}, {passive: true});
carousel.addEventListener('pointerenter', e => {if (e.pointerType === 'mouse') {hovered = true; syncRun();}});
carousel.addEventListener('pointerleave', () => {hovered = false; syncRun();});
carousel.addEventListener('focusin', () => {focused = !mobile.matches; syncRun();});
carousel.addEventListener('focusout', () => {setTimeout(() => {focused = !mobile.matches && carousel.contains(document.activeElement); syncRun();}, 0);});
pauseButton.onclick = () => {userPaused = !userPaused; pauseButton.setAttribute('aria-pressed', String(userPaused)); pauseButton.setAttribute('aria-label', userPaused ? '恢复自动滚动' : '暂停自动滚动'); pauseButton.textContent = userPaused ? '▷' : 'Ⅱ'; syncRun();};
for (const [name, direction] of [['prev',-1],['next',1]]) {
  $(`[data-carousel="${name}"]`).onclick = () => {
    resumeAt = performance.now() + 2200; clearTimeout(resumeTimer); syncRun();
    viewport.scrollBy({left: direction * (span/count || 280), behavior: motion.matches ? 'instant' : 'smooth'});
    resumeTimer = setTimeout(syncRun, 2250);
  };
}
new IntersectionObserver(entries => {visible = entries[0].isIntersecting; syncRun();}, {threshold: .05}).observe(viewport);
new ResizeObserver(resizeCards).observe(viewport);
document.addEventListener('visibilitychange', syncRun);
mobile.addEventListener('change', () => {resizeCards(); syncRun();}); motion.addEventListener('change', syncRun);
readJSON('content/works.json').then(items => {
  count = items.length;
  const tiles = [];
  for (let repeat = 0; repeat < 3; repeat++) for (const item of items) tiles.push(makeTile(item, repeat !== 1));
  track.replaceChildren(...tiles); resizeCards(); syncRun(); window.dispatchEvent(new Event('site:layout'));
}).catch(error => {
  const p = document.createElement('p'); p.textContent = '作品暂时没有加载。';
  const a = document.createElement('a'); a.textContent = '前往 GitHub 查看全部项目 ↗'; externalLink(a, 'https://github.com/FengLi-AI?tab=repositories');
  track.replaceChildren(p,a); console.warn(error);
});

// Touch suspends the belt immediately, then resumes after the visitor has finished reading.
const pauseTouch = () => { touching = true; clearTimeout(resumeTimer); syncRun(); };
const resumeTouch = () => { touching = false; resumeAt = performance.now() + 2200; clearTimeout(resumeTimer); resumeTimer = setTimeout(syncRun, 2250); };
carousel.addEventListener('touchstart', pauseTouch, {passive: true});
carousel.addEventListener('touchend', resumeTouch, {passive: true});
carousel.addEventListener('touchcancel', resumeTouch, {passive: true});

// Let the scroll gesture finish, then gently settle close to a chapter's resting pose.
let settleTimer = 0, settleBusy = false, gestureUntil = 0, lastSettledAt = 0;
let fingerDown = false;
function queueSettle() {
  clearTimeout(settleTimer);
  if (motion.matches || window.siteReading || settleBusy || fingerDown || performance.now() > gestureUntil) return;
  settleTimer = setTimeout(() => {
    if (fingerDown || window.siteReading || settleBusy || performance.now()-lastSettledAt < 850) return;
    const y = scrollY;
    const positions = [...document.querySelectorAll('.scene')].map(s => s.offsetTop);
    const nearest = positions.reduce((a,b) => Math.abs(b-y)<Math.abs(a-y)?b:a);
    const distance = nearest-y;
    const radius = innerHeight * (distance > 0 ? .43 : .23);
    if (Math.abs(distance)<3 || Math.abs(distance)>radius) return;
    settleBusy = true; lastSettledAt = performance.now();
    window.scrollTo({top: nearest, behavior:'smooth'});
    setTimeout(() => {settleBusy = false; gestureUntil = 0;}, 700);
  }, 180);
}
function noteGesture(event) {
  if (event.target instanceof Element && event.target.closest('.work-carousel, .reader, input, textarea, select')) return;
  gestureUntil = performance.now()+1500; queueSettle();
}
window.addEventListener('wheel', noteGesture, {passive:true});
window.addEventListener('touchstart', event => {fingerDown = true; noteGesture(event);}, {passive:true});
window.addEventListener('touchend', () => {fingerDown = false; queueSettle();}, {passive:true});
window.addEventListener('touchcancel', () => {fingerDown = false;}, {passive:true});
window.addEventListener('scroll', queueSettle, {passive:true});
window.addEventListener('keydown', event => {if (['PageDown','PageUp','ArrowDown','ArrowUp',' '].includes(event.key)) noteGesture(event);});
