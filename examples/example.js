import { MagazineNavigator } from '../src/magaziner.js';

document.addEventListener('DOMContentLoaded', () => {
  const container = document.querySelector('#pagecontainer');
  new MagazineNavigator(container, 'a[data-ajax]');
});
