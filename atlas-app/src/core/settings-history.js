import {canonical} from './experiment.js';
const equal=(a,b)=>canonical(a)===canonical(b);
export class SettingsHistory{
  constructor(limit=20){if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('Use a history limit from 1 to 100.');this.limit=limit;this.clear();}
  clear(){this.context=null;this.entries=[];this.gesture=null;}
  sync(context){if(context!==this.context){this.clear();this.context=context;}return this;}
  begin(context,parameters){this.sync(context);if(!this.gesture)this.gesture={before:structuredClone(parameters),pushed:false};}
  end(){this.gesture=null;}
  record(context,before,after){this.sync(context);if(equal(before,after))return;const g=this.gesture;
    if(g){if(equal(g.before,after)){if(g.pushed){this.entries.pop();if(g.evicted)this.entries.unshift(g.evicted);}g.pushed=false;g.evicted=null;}else if(!g.pushed){g.evicted=this.push(g.before);g.pushed=true;}}
    else this.push(before);
  }
  push(value){this.entries.push(structuredClone(value));return this.entries.length>this.limit?this.entries.shift():null;}
  canRestore(context){this.sync(context);return this.entries.length>0;}
  restore(context,validate=value=>value){this.sync(context);this.end();if(!this.entries.length)return null;const value=validate(structuredClone(this.entries.at(-1)));this.entries.pop();return structuredClone(value);}
}
