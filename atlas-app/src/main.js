import {mountAmbientContours} from './ui/ambient-contours.js';
import {loadContent} from './data/load-content.js';
import {startApp} from './ui/screens.js';
try{startApp(await loadContent());mountAmbientContours();}catch(error){const main=document.getElementById('main');main.innerHTML='<div class="not-found"><h1>The atlas could not load.</h1><p id="load-error"></p><button onclick="location.reload()">Try again</button></div>';document.getElementById('load-error').textContent=error.message;}
