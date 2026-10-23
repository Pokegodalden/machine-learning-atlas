import {validateExperiment,parseExperiment} from './experiment-library.js';
// Small configurations travel in the fragment; CSV sources stay in portable files.
export const maxShareBytes=6144;
const maxTokenLength=Math.ceil(maxShareBytes/3)*4;
export function shareToken(document,D){
 if(document?.configuration?.dataset?.imported)throw Error('Use Experiment JSON to share imported CSV data. CSV source is not included in links.');
 const doc=validateExperiment(document,D),bytes=new TextEncoder().encode(JSON.stringify(doc));
 if(bytes.length>maxShareBytes)throw Error('These settings are too large for a sharing link. Use Experiment JSON instead.');
 let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
 return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export function readShareToken(token,D){
 if(typeof token!=='string'||!token.length||token.length>maxTokenLength||!/^[A-Za-z0-9_-]+$/.test(token)||token.length%4===1)throw Error('This sharing link is invalid or too large. Request an Experiment JSON file instead.');
 let text;try{const binary=atob(token.replace(/-/g,'+').replace(/_/g,'/'));if(binary.length>maxShareBytes)throw Error();text=new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(binary,c=>c.charCodeAt(0)));}catch{throw Error('This sharing link could not be decoded.');}
 const doc=parseExperiment(text,D);if(doc.configuration.dataset.imported)throw Error('CSV source cannot be opened from a sharing link. Import the Experiment JSON file instead.');return doc;
}
export function experimentShareUrl(document,D,address){
 const url=new URL(address);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('Open the app from an HTTP or HTTPS address before creating a link.');
 url.search='';url.hash='/shared/'+shareToken(document,D);return url.href;
}
