// Keep navigation available on archive/about pages, independently of report filters.
(() => {
  const button = document.querySelector('[data-back-to-top]');
  if (!button) return;
  const update = () => { button.hidden = window.scrollY <= 320; };
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('pageshow', update);
  button.addEventListener('click', () => {
    window.scrollTo({ top: 0, left: 0,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    document.querySelector('.brand')?.focus({ preventScroll: true });
  });
  update();
})();

(() => {
  const search = document.querySelector('#search');
  const topics = [...document.querySelectorAll('[data-topic]')];
  const buttons = [...document.querySelectorAll('[data-filter]')];
  if (!search || !topics.length) return;
  let category = 'all';
  function update() {
    const query = search.value.trim().toLocaleLowerCase();
    let visible = 0;
    topics.forEach((topic) => {
      const matches = (category === 'all' || topic.dataset.category === category) && (!query || topic.textContent.toLocaleLowerCase().includes(query));
      topic.hidden = !matches;
      if (matches) visible++;
    });
    document.querySelectorAll('[data-stream]').forEach((section) => {
      const rows = [...section.querySelectorAll('[data-topic]')];
      section.hidden = rows.length ? rows.every((topic) => topic.hidden) : Boolean(query || category !== 'all');
    });
    document.querySelector('#empty').hidden = visible !== 0;
    document.querySelector('#filter-result').textContent = `显示 ${visible} 个主题`;
  }
  search.addEventListener('input', update);
  function setCategory(value) {
    category = value;
    buttons.forEach((item) => { const active = item.dataset.filter === value; item.classList.toggle('active', active); item.setAttribute('aria-pressed', String(active)); });
    update();
  }
  buttons.forEach((button) => button.addEventListener('click', () => setCategory(button.dataset.filter)));
  document.querySelectorAll('[data-clear-filters]').forEach((link) => link.addEventListener('click', () => {
    search.value = '';
    setCategory('all');
  }));
  update();
})();
