import { ready }                          from 'https://lsong.org/scripts/dom.js';
import { h, render, useState, useEffect } from 'https://lsong.org/scripts/components/react.js';

const App = () => {
  const [] = useState();
  useEffect(() => {
    console.log('App is ready');
  }, []);
  return [
    h('h2', null, "App"),
    h('ul', null, [
      h('li', null, "Link")
    ])
  ]
}

ready(() => {
  const app = document.getElementById('app');
  render(h(App), app);
});