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
    document.querySelector('#empty').hidden = visible !== 0;
    document.querySelector('#filter-result').textContent = `显示 ${visible} 个主题`;
  }
  search.addEventListener('input', update);
  buttons.forEach((button) => button.addEventListener('click', () => {
    category = button.dataset.filter;
    buttons.forEach((item) => { const active = item === button; item.classList.toggle('active', active); item.setAttribute('aria-pressed', String(active)); });
    update();
  }));
  update();
})();
