const panelIds=['experiment-tools','guided-activity','task-data-workbench','csv-workbench'];
const visible=el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight;};
const detailKey=el=>el.id?'#'+el.id:el.querySelector(':scope > summary')?.textContent.trim();

// Capture at completion, so scrolling or editing while a worker runs is respected.
export function captureLessonView(main){
 const focused=main.contains(document.activeElement)?document.activeElement:null;
 let anchor=focused&&focused.id&&visible(focused)?focused:document.elementFromPoint(innerWidth/2,innerHeight/3)?.closest('[id]');
 if(!anchor||anchor===main||!main.contains(anchor))anchor=[...main.querySelectorAll('[id]')].filter(visible).sort((a,b)=>Math.abs(a.getBoundingClientRect().top-innerHeight/3)-Math.abs(b.getBoundingClientRect().top-innerHeight/3))[0];
 const focusSelector=focused?.id?'#'+CSS.escape(focused.id):['data-param-number','data-param-range','data-level','data-beat'].map(key=>focused?.hasAttribute(key)?`[${key}="${CSS.escape(focused.getAttribute(key))}"]`:null).find(Boolean);
 return {x:scrollX,y:scrollY,anchorId:anchor?.id,anchorTop:anchor?.getBoundingClientRect().top,focused,focusSelector,
  panels:new Map(panelIds.map(id=>[id,main.querySelector('#'+id)]).filter(([,node])=>node)),
  details:[...main.querySelectorAll('details')].map(el=>({key:detailKey(el),open:el.open}))};
}
export function mountLessonPanel(main,view,id,mount){
 const retained=view?.panels.get(id);
 if(retained)main.querySelector('.lesson-layout').before(retained);else mount();
}
export function restoreLessonView(main,view){
 if(!view)return;
 const details=[...main.querySelectorAll('details')];
 for(const state of view.details){const el=details.find(el=>detailKey(el)===state.key);if(el)el.open=state.open;}
 const focused=view.focused?.isConnected?view.focused:view.focusSelector?main.querySelector(view.focusSelector):null;
 if(focused&&!focused.disabled)focused.focus({preventScroll:true});
 const anchor=view.anchorId?main.querySelector('#'+CSS.escape(view.anchorId)):null;
 const top=anchor?scrollY+anchor.getBoundingClientRect().top-view.anchorTop:view.y;
 window.scrollTo({left:view.x,top,behavior:'instant'});
}
