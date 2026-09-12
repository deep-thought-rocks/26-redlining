// Mobile navigation: the hamburger toggles the header's nav below 640px (see site.css).
const header = document.querySelector('.top')
const menu = header?.querySelector('.menu')
menu?.addEventListener('click', () => {
  const open = !header.hasAttribute('data-open')
  header.toggleAttribute('data-open', open)
  menu.setAttribute('aria-expanded', String(open))
})
