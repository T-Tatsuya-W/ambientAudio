import {progressions,getReferenceHz} from './music.js';
import {AmbientEngine} from './audio-engine.js';

const defaults={master:25,palette:'warm',tempo:10,pad:65,noise:18,noiseColour:'pink',
 brightness:950,motion:true,amOn:true,amFreq:16,amDepth:45,
 binauralOn:false,beat:16,droneLevel:34,customRoot:false,rootHz:130.81};
const el=id=>document.getElementById(id);
const ids=Object.keys(defaults);
const labels={master:v=>v+'%',tempo:v=>v+' s',pad:v=>v+'%',noise:v=>v+'%',brightness:v=>v+' Hz',
 amFreq:v=>v+' Hz',amDepth:v=>v+'%',beat:v=>v+' Hz',droneLevel:v=>v+'%',rootHz:v=>Number(v).toFixed(2)+' Hz'};
let state={...defaults};
try{
 const saved=JSON.parse(localStorage.getItem('ambient-audio-settings')||'{}');
 for(const id of ids)if(typeof saved[id]===typeof defaults[id])state[id]=saved[id];
}catch{}
if(!progressions[state.palette])state.palette='warm';
if(!['white','pink','brown','grey','orange'].includes(state.noiseColour))state.noiseColour='pink';
if(!Number.isFinite(state.rootHz)||state.rootHz<55||state.rootHz>440)state.rootHz=defaults.rootHz;
const engine=new AmbientEngine({
 onStatus:message=>el('status').textContent=message,
 onPlayback:isPlaying=>{el('toggle').textContent=isPlaying?'Ⅱ Pause audio':engine.playing?'▶ Resume audio':'▶ Start audio'}
});
function persist(){try{localStorage.setItem('ambient-audio-settings',JSON.stringify(state))}catch{}}
function refresh(){
 const p=progressions[state.palette],drone=p.drone;
 for(const id of ids){const node=el(id);if(!node)continue;if(node.type==='checkbox')node.checked=state[id];else node.value=state[id];if(labels[id]&&el(id+'Val'))el(id+'Val').textContent=labels[id](state[id])}
 el('progressionInfo').textContent=p.chords.length+' chords · '+(p.chords.length*state.tempo)+' s per loop · '+p.names.join(' → ');
 el('rootInfo').textContent='Reference: '+getReferenceHz(state.palette,state.customRoot?state.rootHz:0).toFixed(2)+' Hz. '+(drone?'Held as an uninterrupted drone.':'Used only to calculate chord pitches.');
 el('rootHz').disabled=!state.customRoot;
 el('binauralOn').disabled=!drone;
 el('beat').disabled=!drone;
 el('droneLevel').disabled=!drone;
 el('binauralInfo').textContent=drone
   ?'Binaural replaces the continuous drone: left = reference − half the beat difference; right = reference + half. Stereo headphones required.'
   :'Select Pedal Drone or Microtonal Drone to enable binaural beats. Other progressions have no continuous reference note.';
 el('droneInfo').textContent=drone?'The fixed drone plays continuously, even as the chords change.':'This progression has no continuously sounding note.';
}
engine.setState(state);
for(const id of ids){
 const node=el(id);if(!node)continue;
 node.addEventListener(node.type==='checkbox'||node.tagName==='SELECT'?'change':'input',()=>{
  const previous=state[id];
  state[id]=node.type==='checkbox'?node.checked:typeof defaults[id]==='number'?Number(node.value):node.value;
  if(id==='rootHz')state.rootHz=Math.max(55,Math.min(440,state.rootHz||defaults.rootHz));
  if(id==='palette'&&!progressions[state.palette])state.palette='warm';
  if(id==='noiseColour'&&!['white','pink','brown','grey','orange'].includes(state.noiseColour))state.noiseColour='pink';
  if(previous===state[id])return;
  // Binaural preference is stored, but never activated outside a drone preset.
  persist();refresh();engine.setState(state,id);
 });
}
el('toggle').addEventListener('click',()=>engine.play());
el('stop').addEventListener('click',()=>engine.stop());
let bypass=null;
el('bypass').addEventListener('click',()=>{
 if(bypass){state.amOn=bypass.amOn;state.binauralOn=bypass.binauralOn;bypass=null}
 else{bypass={amOn:state.amOn,binauralOn:state.binauralOn};state.amOn=false;state.binauralOn=false}
 el('bypass').textContent=bypass?'Restore modulation':'Bypass all modulation';
 persist();refresh();engine.setState(state);
});
el('reset').addEventListener('click',()=>{
 state={...defaults};bypass=null;el('bypass').textContent='Bypass all modulation';
 localStorage.removeItem('ambient-audio-settings');refresh();engine.setState(state,'palette');
});
document.addEventListener('visibilitychange',()=>{
 if(engine.playing&&!engine.paused&&engine.ctx?.state==='running')engine.fill();
 else if(engine.playing&&!engine.paused&&engine.ctx?.state==='suspended')el('status').textContent='Android/browser suspended audio — reopen and tap Resume';
});
refresh();
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.warn));
