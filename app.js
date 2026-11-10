// Ambient Audio Lab — Web Audio synthesiser and experiment controls.
const defaults={master:25,palette:'warm',tempo:10,pad:65,noise:18,brightness:950,motion:true,amOn:true,amFreq:16,amDepth:45,binauralOn:false,carrier:220,beat:16,binauralMix:12};
const el=id=>document.getElementById(id);
const ids=Object.keys(defaults);
const progressions={
 warm:{name:'Warm / major seventh',chords:[[48,55,59,64],[45,52,55,60],[41,48,52,57],[43,50,57,62]],names:['Cmaj7','Am7','Fmaj7','Gsus2']},
 dream:{name:'Dreamy / suspended',chords:[[48,55,60,62],[45,52,57,60],[41,48,55,60],[43,50,55,62]],names:['Csus2','Am','Fsus2','G5']},
 minor:{name:'Dusky / minor',chords:[[45,52,57,60],[41,48,52,57],[38,45,50,53],[40,47,52,55]],names:['Am','Fmaj7','Dm','Em']},
 horizon:{name:'Horizon',chords:[[48,55,59,64],[43,50,55,59],[45,52,55,60],[41,48,52,57],[48,55,60,64],[43,50,57,62],[41,48,52,57],[43,50,55,62]],names:['Cmaj7','Gmaj','Am7','Fmaj7','C','Gsus2','Fmaj7','G5']},
 night:{name:'Nightfall',chords:[[45,52,57,60],[41,48,52,57],[48,55,59,64],[43,50,55,59],[38,45,50,53],[41,48,52,57],[40,47,52,55],[43,50,55,59]],names:['Am','Fmaj7','Cmaj7','Gmaj','Dm','Fmaj7','Em','Gmaj']},
 floating:{name:'Floating',chords:[[48,55,60,62],[45,52,57,60],[41,48,55,60],[43,50,55,62],[40,47,52,55],[45,52,57,60],[38,45,50,57],[43,50,55,62],[48,55,60,62],[41,48,55,60],[38,45,53,57],[43,50,55,62]],names:['Csus2','Am','Fsus2','G5','Em','Am','Dsus2','G5','Csus2','Fsus2','Dm','G5']},
 journey:{name:'Slow journey',chords:[[48,55,59,64],[45,52,55,60],[41,48,52,57],[43,50,55,59],[40,47,52,55],[45,52,57,60],[38,45,50,53],[43,50,55,62],[48,55,60,64],[43,50,55,59],[41,48,52,57],[45,52,55,60],[38,45,53,57],[41,48,52,57],[43,50,57,62],[48,55,59,64]],names:['Cmaj7','Am7','Fmaj7','Gmaj','Em','Am','Dm','G5','C','Gmaj','Fmaj7','Am7','Dm','Fmaj7','Gsus2','Cmaj7']}
};
const format={master:v=>v+'%',tempo:v=>v+' s',pad:v=>v+'%',noise:v=>v+'%',brightness:v=>v+' Hz',amFreq:v=>v+' Hz',amDepth:v=>v+'%',carrier:v=>v+' Hz',beat:v=>v+' Hz',binauralMix:v=>v+'%'};
let state={...defaults};
try{const saved=JSON.parse(localStorage.getItem('ambient-audio-settings')||'{}');for(const id of ids){if(typeof saved[id]===typeof defaults[id])state[id]=saved[id]}}catch{}
if(!progressions[state.palette])state.palette='warm';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const hz=midi=>440*2**((midi-69)/12);
const level=v=>(Number(v)/100)**1.7;
function save(){localStorage.setItem('ambient-audio-settings',JSON.stringify(state))}
function refresh(){
 for(const id of ids){const node=el(id);if(node.type==='checkbox')node.checked=state[id];else node.value=state[id];if(format[id])el(id+'Val').textContent=format[id](state[id])}
 const p=progressions[state.palette];el('progressionInfo').textContent=p.chords.length+' chords · '+(p.chords.length*state.tempo)+' seconds per loop · '+p.names.join(' → ');
}
let ctx,master,padBus,noiseGain,filter,filterAmount,amGain,amAmount,amLfo,binauralGain,leftOsc,rightOsc;
let outputElement,usingMediaElement=false,active=false,paused=false,scheduled=[],timer=null,nextChordTime=0,chordIndex=0,sessionId=0;
// The browser can throttle timers in the background. Queue 90 seconds of chords on
// AudioContext's sample-accurate clock, and replenish the queue periodically.
const LOOKAHEAD=90;
function createNoiseBuffer(){
 const buf=ctx.createBuffer(1,ctx.sampleRate*4,ctx.sampleRate),data=buf.getChannelData(0);
 let b0=0,b1=0,b2=0;
 for(let i=0;i<data.length;i++){const white=Math.random()*2-1;b0=.99765*b0+white*.0990460;b1=.963*b1+white*.2965164;b2=.57*b2+white*1.0526913;data[i]=clamp((b0+b1+b2+white*.1848)*.12,-1,1)}
 // Seamless loop: overlap/crossfade the last 200 ms into the beginning and
 // use the crossfaded tail as a wrap point.
 const fade=Math.round(ctx.sampleRate*.2),end=data.length;
 for(let i=0;i<fade;i++){const t=i/(fade-1);const tail=data[end-fade+i],head=data[0];data[end-fade+i]=tail*(1-t)+head*t}
 return buf;
}
function setStatus(message){el('status').textContent=message}
function updateAudio(){
 if(!ctx)return;
 const t=ctx.currentTime,d=state.amOn?state.amDepth/100:0;
 master.gain.setTargetAtTime(level(state.master)*.65,t,.05);
 padBus.gain.setTargetAtTime(level(state.pad)*.12,t,.15);
 noiseGain.gain.setTargetAtTime(level(state.noise)*.16,t,.15);
 filter.frequency.setTargetAtTime(state.brightness,t,.12);
 amGain.gain.setTargetAtTime(1-d/2,t,.04);amAmount.gain.setTargetAtTime(d/2,t,.04);amLfo.frequency.setTargetAtTime(state.amFreq,t,.05);
 binauralGain.gain.setTargetAtTime(state.binauralOn?state.binauralMix/100*.2:0,t,.06);
 leftOsc.frequency.setTargetAtTime(state.carrier,t,.06);
 rightOsc.frequency.setTargetAtTime(state.carrier+state.beat,t,.06);
 filterAmount.gain.setTargetAtTime(state.motion?Math.min(200,state.brightness*.16):0,t,.25);
}
function scheduleChord(notes,start,duration){
 const voice={start,osc:[],amp:[],ended:false};
 for(const midi of notes){
  const amp=ctx.createGain();
  // The note has a slow envelope; ramp down before releasing its oscillator.
  const attack=Math.min(2.8,duration*.35),release=3;
  amp.gain.setValueAtTime(0,start);
  amp.gain.linearRampToValueAtTime(.34,start+attack);
  amp.gain.setValueAtTime(.34,start+duration);
  amp.gain.linearRampToValueAtTime(0,start+duration+release);
  amp.connect(padBus);voice.amp.push(amp);
  for(const [type,detune,weight] of [['sine',-3,.65],['triangle',3,.17]]){
   const osc=ctx.createOscillator(),gain=ctx.createGain();
   osc.type=type;osc.frequency.value=hz(midi);osc.detune.value=detune;gain.gain.value=weight;
   osc.connect(gain).connect(amp);
   osc.start(start);osc.stop(start+duration+release+.05);
   osc.onended=()=>{osc.disconnect();gain.disconnect()};
   voice.osc.push(osc);
  }
 }
 scheduled.push(voice);
}
function reap(){
 const t=ctx.currentTime;
 scheduled=scheduled.filter(voice=>{
  if(voice.start+Math.max(4,state.tempo)+3.5>t)return true;
  for(const amp of voice.amp){try{amp.disconnect()}catch{}}
  return false;
 });
}
function fillQueue(){
 if(!ctx||!active||paused||ctx.state!=='running')return;
 const now=ctx.currentTime;
 if(nextChordTime<now){ // Browser wake-up after a throttled timer; skip elapsed musical time.
  const duration=state.tempo;
  const missed=Math.ceil((now-nextChordTime)/duration);
  chordIndex+=missed;
  nextChordTime+=missed*duration;
 }
 while(nextChordTime<now+LOOKAHEAD){
  const p=progressions[state.palette];
  scheduleChord(p.chords[chordIndex%p.chords.length],nextChordTime,state.tempo);
  chordIndex++;
  nextChordTime+=state.tempo;
 }
 reap();
}
function clearScheduled(){
 for(const voice of scheduled){
  for(const o of voice.osc){o.onended=null;try{o.stop()}catch{}try{o.disconnect()}catch{}}
  for(const g of voice.amp){try{g.disconnect()}catch{}}
 }
 scheduled=[];
}
function requeue(){
 if(!ctx||!active)return;
 clearScheduled();
 chordIndex=0;nextChordTime=ctx.currentTime+.04;
 fillQueue();
}
function updateSession(){
 if(!('mediaSession' in navigator))return;
 try{
  if('MediaMetadata' in window)navigator.mediaSession.metadata=new MediaMetadata({
   title:progressions[state.palette].name,
   artist:'Ambient Audio Lab',
   album:'Generative focus soundscapes',
   artwork:[{src:new URL('./icon-512.png',location.href).href,sizes:'512x512',type:'image/png'}]
  });
  navigator.mediaSession.playbackState=!active?'none':paused?'paused':'playing';
 }catch(error){console.warn('Media Session:',error)}
}
function registerMediaControls(){
 if(!('mediaSession' in navigator))return;
 for(const [action,handler] of [
  ['play',()=>resumePlayback()],
  ['pause',()=>pausePlayback()],
  ['stop',()=>stop()],
  ['nexttrack',()=>nextProgression()]
 ]){
  try{navigator.mediaSession.setActionHandler(action,handler)}catch{}
 }
 updateSession();
}
function nextProgression(){
 const options=Object.keys(progressions),idx=options.indexOf(state.palette);
 state.palette=options[(idx+1)%options.length];save();refresh();requeue();updateSession();
}
async function pausePlayback(){
 if(!ctx||!active||paused)return;
 paused=true;clearInterval(timer);timer=null;
 await ctx.suspend();
 if(outputElement&&usingMediaElement)outputElement.pause();
 el('toggle').textContent='▶ Resume audio';setStatus('Paused');updateSession();
}
async function resumePlayback(){
 if(!ctx||!active){await start();return}
 if(!paused&&ctx.state==='running')return;
 try{
  if(outputElement&&usingMediaElement)await outputElement.play();
  await ctx.resume();paused=false;
  clearScheduled();nextChordTime=ctx.currentTime+.06;fillQueue();
  clearInterval(timer);timer=setInterval(fillQueue,1000);
  el('toggle').textContent='Ⅱ Pause audio';setStatus('Playing · '+(usingMediaElement?'media playback':'Web Audio'));
  updateSession();
 }catch(error){setStatus('Could not resume: '+error.message)}
}
async function start(){
 if(active){if(paused||ctx?.state==='suspended')await resumePlayback();else await pausePlayback();return}
 const token=++sessionId;
 try{
  ctx=new AudioContext();await ctx.resume();
  master=ctx.createGain();master.gain.value=0;
  const compressor=ctx.createDynamicsCompressor();compressor.threshold.value=-15;compressor.knee.value=16;compressor.ratio.value=10;compressor.attack.value=.005;compressor.release.value=.2;
  compressor.connect(master);
  // HTMLAudioElement playback is more likely to get browser media controls on
  // Android than a raw AudioContext. Fall back to direct WebAudio if rejected.
  const streamOutput=ctx.createMediaStreamDestination();master.connect(streamOutput);
  outputElement=document.createElement('audio');outputElement.srcObject=streamOutput.stream;
  outputElement.autoplay=false;outputElement.playsInline=true;outputElement.setAttribute('playsinline','');
  outputElement.style.display='none';document.body.append(outputElement);
  try{await outputElement.play();usingMediaElement=true}
  catch(e){console.warn('Media stream element not supported, falling back:',e);master.connect(ctx.destination);usingMediaElement=false}
  if(token!==sessionId)return;
  const ambientBus=ctx.createGain(),noiseSource=ctx.createBufferSource();
  amGain=ctx.createGain();ambientBus.connect(amGain).connect(compressor);
  amLfo=ctx.createOscillator();amAmount=ctx.createGain();amLfo.type='sine';amLfo.connect(amAmount).connect(amGain.gain);amLfo.start();
  filter=ctx.createBiquadFilter();filter.type='lowpass';filter.Q.value=.3;filter.connect(ambientBus);
  const filterLfo=ctx.createOscillator();filterLfo.frequency.value=.055;filterAmount=ctx.createGain();filterLfo.connect(filterAmount).connect(filter.frequency);filterLfo.start();
  padBus=ctx.createGain();padBus.connect(filter);
  noiseGain=ctx.createGain();noiseGain.connect(filter);noiseSource.buffer=createNoiseBuffer();noiseSource.loop=true;noiseSource.connect(noiseGain);noiseSource.start();
  binauralGain=ctx.createGain();binauralGain.gain.value=0;
  const merge=ctx.createChannelMerger(2);leftOsc=ctx.createOscillator();rightOsc=ctx.createOscillator();
  leftOsc.connect(merge,0,0);rightOsc.connect(merge,0,1);merge.connect(binauralGain).connect(compressor);
  leftOsc.start();rightOsc.start();
  active=true;paused=false;chordIndex=0;nextChordTime=ctx.currentTime+.06;
  updateAudio();fillQueue();timer=setInterval(fillQueue,1000);
  el('toggle').textContent='Ⅱ Pause audio';setStatus('Playing · '+(usingMediaElement?'media playback':'Web Audio'));
  registerMediaControls();
  ctx.onstatechange=()=>{if(!active||paused)return;if(ctx.state==='suspended'){setStatus('Audio suspended by browser; tap to resume');el('toggle').textContent='▶ Resume audio'}else if(ctx.state==='running'){fillQueue();setStatus('Playing · audio running');el('toggle').textContent='Ⅱ Pause audio'}};
 }catch(error){
  console.error(error);setStatus('Audio error: '+error.message);
  await stop();
 }
}
async function stop(){
 ++sessionId;active=false;paused=false;clearInterval(timer);timer=null;
 const old=ctx;ctx=null;
 if(old){try{await old.close()}catch{}}
 scheduled=[];if(outputElement){outputElement.pause();outputElement.srcObject=null;outputElement.remove();outputElement=null}
 usingMediaElement=false;el('toggle').textContent='▶ Start audio';setStatus('Stopped');updateSession();
}
el('toggle').addEventListener('click',()=>start());
el('stop').addEventListener('click',()=>stop());
for(const id of ids){
 const node=el(id);node.addEventListener(node.type==='checkbox'||node.tagName==='SELECT'?'change':'input',()=>{
  const previous=state[id];
  state[id]=node.type==='checkbox'?node.checked:typeof defaults[id]==='number'?Number(node.value):node.value;
  save();refresh();updateAudio();
  if(id==='palette'){if(active)requeue();updateSession()}
  else if(id==='tempo'&&active&&state[id]!==previous)requeue();
 });
}
let bypassState=null;
el('bypass').addEventListener('click',()=>{
 if(bypassState){state.amOn=bypassState.amOn;state.binauralOn=bypassState.binauralOn;bypassState=null}
 else{bypassState={amOn:state.amOn,binauralOn:state.binauralOn};state.amOn=false;state.binauralOn=false}
 el('bypass').textContent=bypassState?'Restore modulation':'Bypass all modulation';
 save();refresh();updateAudio();
});
el('reset').addEventListener('click',()=>{
 state={...defaults};bypassState=null;el('bypass').textContent='Bypass all modulation';
 localStorage.removeItem('ambient-audio-settings');refresh();updateAudio();if(active)requeue();updateSession();
});
document.addEventListener('visibilitychange',()=>{
 if(ctx&&active&&!paused&&ctx.state==='running')fillQueue();
 else if(ctx&&active&&!paused&&ctx.state==='suspended')setStatus('Browser suspended audio. Open app and tap Resume.');
});
refresh();
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.warn));
