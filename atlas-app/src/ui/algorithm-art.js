import {mathArtMarkup} from './art-geometry.js';
// Schematic mathematical illustrations. They never represent computed model results.
export function algorithmArt(id){
 const dots=(points,color='var(--cyan)')=>points.map(([x,y])=>`<circle cx="${x}" cy="${y}" r="3" fill="${color}"/>`).join('');
 const cloud=[[28,89],[44,80],[59,84],[74,68],[88,72],[104,55],[121,60],[139,43],[154,48],[171,30],[188,34]];
 const axes='<path class="art-axis" d="M18 12V106H205"/>';
 let scene='';
 if(id==='linear-regression')scene=mathArtMarkup(id);
 else if(id==='knn')scene='<circle class="art-neighborhood art-motion" cx="108" cy="60" r="37"/>'+dots([[30,27],[55,73],[79,43],[91,69],[119,34],[137,63]])+dots([[156,22],[180,56],[158,91],[194,94]],'var(--lavender)')+'<path class="art-gold" d="M108 52L116 60L108 68L100 60Z M108 60L79 43M108 60L91 69M108 60L137 63"/>';
 else if(id==='logistic-regression')scene=axes+'<path class="art-gold art-motion" d="M25 94C73 94 80 88 106 59S134 24 199 24"/><path class="art-axis" stroke-dasharray="3 4" d="M20 60H204"/>'+dots([[36,96],[61,92],[151,25],[185,24]])+'<text x="167" y="109">σ(z)</text>';
 else if(id==='decision-tree')scene='<path class="art-axis" d="M18 17H126V104H18ZM70 17V104M70 60H126"/><path class="art-gold" d="M165 24V44L144 64M165 44L190 64M144 64V88M190 64V88"/>'+dots([[35,36],[48,82],[90,36],[105,46],[86,80],[111,92],[165,24],[144,64],[190,64]]);
 else if(id==='random-forest')scene=[0,1,2].map(i=>`<g transform="translate(${i*62} ${i===1?0:12})"><path class="art-axis" d="M47 14V38L25 58M47 38L69 58M25 58V75M69 58V75"/>${dots([[47,14],[25,58],[69,58]])}</g>`).join('')+'<path class="art-gold art-motion" d="M45 100H176M103 94L111 100L103 106"/>';
 else if(id==='svm')scene=axes+dots([[34,30],[51,42],[67,25],[81,53],[45,64]])+dots([[126,92],[149,75],[173,92],[183,61]],'var(--lavender)')+'<path class="art-gold art-motion" d="M65 105L145 14"/><path class="art-margin" d="M41 105L121 14M89 105L169 14"/><circle class="art-neighborhood" cx="81" cy="53" r="8"/><circle class="art-neighborhood" cx="149" cy="75" r="8"/>';
 else if(id==='kmeans')scene=dots([[31,30],[45,43],[57,23],[68,44],[45,59]])+dots([[135,77],[151,95],[166,74],[181,91],[169,57]],'var(--green)')+'<g class="art-motion"><path class="art-gold" d="M40 37H56M48 29V45M150 79H166M158 71V87"/><ellipse class="art-neighborhood" cx="49" cy="40" rx="35" ry="29"/><ellipse class="art-neighborhood" cx="159" cy="79" rx="35" ry="29"/></g>';
 else if(id==='pca')scene=mathArtMarkup(id);
 else if(id==='mlp')scene='<g class="art-neural art-motion">'+[32,60,88].map(y=>[24,48,72,96].map(z=>`<path class="art-axis" d="M36 ${y}L110 ${z}L184 60"/>`).join('')).join('')+'</g>'+dots([[36,32],[36,60],[36,88],[110,24],[110,48],[110,72],[110,96]])+'<circle cx="184" cy="60" r="7" class="art-output"/>';
 else if(id==='q-learning')scene='<path class="art-axis" d="M39 14H180V108H39ZM86 14V108M133 14V108M39 61H180"/><path class="art-gold art-motion" d="M62 85V37H157M149 31L157 37L149 43"/><rect x="91" y="67" width="36" height="36" class="art-wall"/><circle cx="157" cy="37" r="7" class="art-output"/>';
 else scene=axes+dots(cloud)+'<path class="art-gold" d="M25 97Q100 85 195 23"/>';
 return `<svg class="algorithm-art" data-art-id="${id}" data-art-progress="1" viewBox="0 0 220 120" aria-hidden="true"><g fill="none" stroke-linecap="round" stroke-linejoin="round">${scene}</g></svg>`;
}
