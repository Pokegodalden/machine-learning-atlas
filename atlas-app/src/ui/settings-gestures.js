// A continuous pointer/key gesture and a numeric editing session each count as
// one change. Invalid inputs never reach the history recorder.
export function bindSettingsGestures(root,begin,end){
  for(const el of root.querySelectorAll('input[type="number"]')){el.addEventListener('focus',begin);el.addEventListener('blur',end);}
  for(const el of root.querySelectorAll('input[type="range"],[data-dial]')){
    el.addEventListener('pointerdown',begin);el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);el.addEventListener('blur',end);
    el.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.key))begin();});el.addEventListener('keyup',end);
  }
}
