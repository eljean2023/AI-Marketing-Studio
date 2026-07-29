export function renderHomeMenu(container, { logo, title, subtitle, workflows }) {
  container.innerHTML = '';

  const screen = document.createElement('div');
  screen.className = 'home-screen';

  const header = document.createElement('div');
  header.className = 'home-header';

  if (logo) {
    const logoEl = document.createElement('div');
    logoEl.className = 'home-logo';
    logoEl.innerHTML = logo;
    header.appendChild(logoEl);
  }

  const heading = document.createElement('h1');
  heading.className = 'home-title';
  heading.textContent = title;
  header.appendChild(heading);

  if (subtitle) {
    const subheading = document.createElement('p');
    subheading.className = 'home-subtitle';
    subheading.textContent = subtitle;
    header.appendChild(subheading);
  }

  screen.appendChild(header);

  const menu = document.createElement('div');
  menu.className = 'home-menu';

  workflows.forEach((workflow) => {
    menu.appendChild(buildCard(workflow));
  });

  screen.appendChild(menu);
  container.appendChild(screen);
}

function buildCard({ icon, tag, accent, title, description, onSelect, disabled, badge }) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = disabled ? 'home-card home-card-disabled' : 'home-card';

  if (accent) {
    card.style.setProperty('--card-accent', accent);
  }

  const iconWrap = document.createElement('span');
  iconWrap.className = 'home-card-icon-wrap';
  iconWrap.innerHTML = icon;

  const body = document.createElement('span');
  body.className = 'home-card-body';

  if (tag) {
    const tagEl = document.createElement('span');
    tagEl.className = 'home-card-tag';
    tagEl.textContent = tag;
    body.appendChild(tagEl);
  }

  const titleRow = document.createElement('span');
  titleRow.className = 'home-card-title-row';

  const titleEl = document.createElement('span');
  titleEl.className = 'home-card-title';
  titleEl.textContent = title;
  titleRow.appendChild(titleEl);

  if (badge) {
    const badgeEl = document.createElement('span');
    badgeEl.className = 'home-card-badge';
    badgeEl.textContent = badge;
    titleRow.appendChild(badgeEl);
  }

  const descriptionEl = document.createElement('span');
  descriptionEl.className = 'home-card-description';
  descriptionEl.textContent = description;

  body.appendChild(titleRow);
  body.appendChild(descriptionEl);

  card.appendChild(iconWrap);
  card.appendChild(body);

  if (!disabled) {
    const arrowEl = document.createElement('span');
    arrowEl.className = 'home-card-arrow';
    arrowEl.textContent = '→';
    card.appendChild(arrowEl);
  }

  if (disabled) {
    card.disabled = true;
  } else {
    card.addEventListener('click', onSelect);
  }

  return card;
}
