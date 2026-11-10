import {progressions,chordFrequencies,getReferenceHz} from './music.js';

// All synthesis inputs use frequencies in Hz; composition never reaches this layer.
// The continuous reference drone is independent of the scheduled chord envelopes.
export class AmbientEngine {
 constructor({onStatus=()=>{},onPlayback=()=>{}}={}){
  this.onStatus=onStatus;this.onPlayback=onPlayback;this.ctx=null;
  this.playing=false;this.paused=false;this.timer=null;this.voices=[];
  this.index=0;this.nextTime=0;this.horizon=60;this.media=null;
  this.state=null;this.usingMedia=false;
 }
 get rootHz(){return getReferenceHz(this.state.palette,this.state.customRoot?this.state.rootHz:0)}
 get allowsBinaural(){return !!progressions[this.state.palette]?.drone}
 status(message){this.onStatus(message)}
 setState(state,changed=''){
  const previous=this.state;this.state={...state};
  if(!this.ctx)return;
  this.updateAudio();
  const structural=['palette','tempo','customRoot','rootHz'].includes(changed);
  if(structural && this.playing && !this.paused)this.requeue();
  if(changed==='palette'||changed==='customRoot'||changed==='rootHz')this.mediaState();
 }
 async init(){
  this.ctx=new AudioContext();
  const c=this.ctx;
  await c.resume();
  this.master=c.createGain();this.master.gain.value=0;
  const comp=c.createDynamicsCompressor();comp.threshold.value=-18;comp.knee.value=14;comp.ratio.value=8;comp.attack.value=.006;comp.release.value=.22;
  comp.connect(this.master);
  this.stream=c.createMediaStreamDestination();this.master.connect(this.stream);
  this.media=document.createElement('audio');this.media.srcObject=this.stream.stream;
  this.media.autoplay=false;this.media.playsInline=true;this.media.setAttribute('playsinline','');
  this.media.style.display='none';document.body.append(this.media);
  this.usingMedia=false;
  // AM is applied to musical pads, not noise or the continuous drone.
  this.padBus=c.createGain();
  const filter=c.createBiquadFilter();filter.type='lowpass';filter.Q.value=.3;this.filter=filter;
  this.padBus.connect(filter);
  // Modulate the same pad signal separately in L/R without altering its pitches.
  // A single oscillator is routed with either matching or opposite polarity.
  // In-phase: L = B + A*sin(t), R = B + A*sin(t).
  // Alternating: L = B + A*sin(t), R = B - A*sin(t).
  // B=1-depth/2 and A=depth/2; envelopes always stay in [1-depth, 1].
  this.amLeft=c.createGain();this.amRight=c.createGain();
  const padStereo=c.createChannelMerger(2);
  filter.connect(this.amLeft);filter.connect(this.amRight);
  this.amLeft.connect(padStereo,0,0);this.amRight.connect(padStereo,0,1);
  padStereo.connect(comp);
  this.amLeftAmount=c.createGain();this.amRightAmount=c.createGain();
  this.amLfo=c.createOscillator();this.amLfo.type='sine';
  this.amLfo.connect(this.amLeftAmount).connect(this.amLeft.gain);
  this.amLfo.connect(this.amRightAmount).connect(this.amRight.gain);
  this.amLfo.start();
  this.filterMod=c.createGain();this.filterLfo=c.createOscillator();this.filterLfo.frequency.value=.055;
  this.filterLfo.connect(this.filterMod).connect(filter.frequency);this.filterLfo.start();
  this.noiseGain=c.createGain();this.noiseGain.gain.value=0;
  this.noiseGain.connect(comp);  // noise isn't pulsed by AM by default
  if(c.audioWorklet && typeof AudioWorkletNode!=='undefined'){
   try{
    await c.audioWorklet.addModule('./noise-processor.js');
    this.noiseNode=new AudioWorkletNode(c,'coloured-noise',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[1]});
    this.noiseNode.connect(this.noiseGain);
    this.noiseNode.port.postMessage({colour:this.state.noiseColour});
   }catch(err){console.warn('Noise worklet unavailable; using noise buffer:',err);this.initFallbackNoise()}
  }else this.initFallbackNoise();
  this.droneMonoGain=c.createGain();this.droneStereoGain=c.createGain();
  const droneBus=c.createGain();this.droneMonoGain.connect(droneBus);this.droneStereoGain.connect(droneBus);droneBus.connect(comp);
  this.droneOsc=c.createOscillator();this.droneOsc.type='sine';this.droneOsc.connect(this.droneMonoGain);this.droneOsc.start();
  const merge=c.createChannelMerger(2);
  this.leftOsc=c.createOscillator();this.rightOsc=c.createOscillator();
  this.leftOsc.type='sine';this.rightOsc.type='sine';
  this.leftOsc.connect(merge,0,0);this.rightOsc.connect(merge,0,1);
  merge.connect(this.droneStereoGain);this.leftOsc.start();this.rightOsc.start();
  this.updateAudio();
  c.onstatechange=()=>{
   if(!this.playing||this.paused)return;
   if(c.state==='suspended')this.status('Audio suspended by Android/browser. Open app to resume.');
   else if(c.state==='running'){this.fill();this.status('Playing')}
  };
 }
 initFallbackNoise(){
  const c=this.ctx,buffer=c.createBuffer(1,c.sampleRate*8,c.sampleRate),data=buffer.getChannelData(0);
  // Streamlined pinkish fallback; crossfade final samples to first sample.
  let b=0;
  for(let i=0;i<data.length;i++){b=.98*b+.02*(Math.random()*2-1);data[i]=b*.65}
  const fade=Math.round(c.sampleRate*.15);
  for(let i=0;i<fade;i++){let t=i/(fade-1);data[data.length-fade+i]=data[data.length-fade+i]*(1-t)+data[0]*t}
  this.fallback=c.createBufferSource();this.fallback.buffer=buffer;this.fallback.loop=true;
  this.fallback.connect(this.noiseGain);this.fallback.start();
 }
 updateAudio(){
  if(!this.ctx||!this.state)return;
  const c=this.ctx,t=c.currentTime,s=this.state;
  const safe=(param,value,smooth=.07)=>param.setTargetAtTime(value,t,smooth);
  const lev=v=>(Math.max(0,v)/100)**1.7;
  safe(this.master.gain,lev(s.master)*.65);
  safe(this.padBus.gain,lev(s.pad)*.13,.18);
  safe(this.noiseGain.gain,lev(s.noise)*.22,.18);
  safe(this.filter.frequency,s.brightness,.2);
  safe(this.filterMod.gain,s.motion?Math.min(200,s.brightness*.16):0,.25);
  const d=s.amOn?s.amDepth/100:0;
  const alternating=s.amMode==='alternating';
  safe(this.amLeft.gain,1-d/2,.04);
  safe(this.amRight.gain,1-d/2,.04);
  safe(this.amLeftAmount.gain,d/2,.04);
  safe(this.amRightAmount.gain,alternating?-d/2:d/2,.04);
  safe(this.amLfo.frequency,s.amFreq,.04);
  // Stereo tones exactly straddle the continuous reference frequency.
  const root=this.rootHz,half=s.beat/2;
  safe(this.droneOsc.frequency,root,.12);
  safe(this.leftOsc.frequency,Math.max(20,root-half),.12);
  safe(this.rightOsc.frequency,root+half,.12);
  const enabled=this.allowsBinaural&&s.binauralOn,vol=this.allowsBinaural?lev(s.droneLevel)*.2:0;
  safe(this.droneMonoGain.gain,enabled?0:vol,.09);
  safe(this.droneStereoGain.gain,enabled?vol:0,.09);
  if(this.noiseNode)this.noiseNode.port.postMessage({colour:s.noiseColour});
 }
 // hzValues is an array of actual frequencies, including non-12TET notes.
 scheduleFrequencies(hzValues,start,duration){
  const c=this.ctx,voice={start,end:start+duration+3.1,osc:[],amps:[],pending:0};
  const attack=Math.min(2.8,duration*.35),release=3;
  for(const frequency of hzValues){
   if(!Number.isFinite(frequency)||frequency<20||frequency>10000)continue;
   const amp=c.createGain();amp.gain.setValueAtTime(0,start);
   amp.gain.linearRampToValueAtTime(.31,start+attack);
   amp.gain.setValueAtTime(.31,start+duration);
   amp.gain.linearRampToValueAtTime(0,start+duration+release);
   amp.connect(this.padBus);voice.amps.push(amp);
   for(const [type,detune,weight] of [['sine',-3,.65],['triangle',3,.17]]){
    const osc=c.createOscillator(),g=c.createGain();
    osc.type=type;osc.frequency.value=frequency;osc.detune.value=detune;g.gain.value=weight;
    osc.connect(g).connect(amp);
    osc.start(start);osc.stop(start+duration+release+.04);
    voice.pending++;
    osc.onended=()=>{try{osc.disconnect();g.disconnect()}catch{};if(--voice.pending===0){for(const a of voice.amps)try{a.disconnect()}catch{}}};
    voice.osc.push(osc);
   }
  }
  this.voices.push(voice);
 }
 fill(){
  if(!this.ctx||!this.playing||this.paused||this.ctx.state!=='running')return;
  const now=this.ctx.currentTime,duration=this.state.tempo;
  if(this.nextTime<now){
   const missed=Math.ceil((now-this.nextTime)/duration);
   this.index+=missed;this.nextTime+=missed*duration;
  }
  while(this.nextTime<now+this.horizon){
   this.scheduleFrequencies(chordFrequencies(this.state.palette,this.index,this.state.customRoot?this.state.rootHz:0),this.nextTime,duration);
   this.index++;this.nextTime+=duration;
  }
  this.voices=this.voices.filter(v=>{
   if(v.end>now)return true;
   for(const amp of v.amps){try{amp.disconnect()}catch{}}
   return false;
  });
 }
 clearVoices(){
  const now=this.ctx.currentTime;
  for(const v of this.voices){
   // Avoid a hard signal discontinuity when switching progressions or roots.
   for(const amp of v.amps){
    try{
     if(typeof amp.gain.cancelAndHoldAtTime==='function')amp.gain.cancelAndHoldAtTime(now);
     else {amp.gain.cancelScheduledValues(now);amp.gain.setValueAtTime(amp.gain.value,now)}
     amp.gain.linearRampToValueAtTime(0,now+.12);
    }catch{}
   }
   for(const osc of v.osc){try{osc.stop(now+.14)}catch{}}
  }
  // onended performs the graph disconnections after the fade.
  this.voices=[];
 }
 requeue(){
  if(!this.ctx)return;
  this.clearVoices();this.index=0;this.nextTime=this.ctx.currentTime+.06;
  this.fill();
 }
 mediaState(){
  if(!('mediaSession' in navigator))return;
  try{
   if('MediaMetadata' in window)navigator.mediaSession.metadata=new MediaMetadata({
    title:progressions[this.state.palette].name,
    artist:'Ambient Audio Lab',album:'Generative soundscapes',
    artwork:[{src:new URL('./icon-512.png',location.href).href,sizes:'512x512',type:'image/png'}]
   });
   navigator.mediaSession.playbackState=!this.playing?'none':this.paused?'paused':'playing';
  }catch(err){console.warn('Media Session metadata unavailable',err)}
 }
 mediaHandlers(){
  if(!('mediaSession' in navigator))return;
  for(const [name,fn] of [['play',()=>this.resume()],['pause',()=>this.pause()],['stop',()=>this.stop()]]){
   try{navigator.mediaSession.setActionHandler(name,fn)}catch{}
  }
  this.mediaState();
 }
 async play(){
  if(this.playing){if(this.paused||this.ctx?.state==='suspended')return this.resume();return this.pause()}
  try{
   await this.init();
   // Play after creating sources. Browser fallback still works if media stream playback is unavailable.
   try{await this.media.play();this.usingMedia=true}
   catch(err){console.warn('HTML media pipeline unavailable',err);this.master.connect(this.ctx.destination)}
   this.playing=true;this.paused=false;this.index=0;this.nextTime=this.ctx.currentTime+.06;
   this.fill();this.timer=setInterval(()=>this.fill(),750);
   this.mediaHandlers();this.status('Playing · '+(this.usingMedia?'media stream':'Web Audio'));
   this.onPlayback(true);
  }catch(err){console.error(err);await this.stop();this.status('Audio error: '+err.message)}
 }
 async pause(){
  if(!this.playing||this.paused)return;
  this.paused=true;clearInterval(this.timer);this.timer=null;
  await this.ctx.suspend();
  if(this.usingMedia)this.media.pause();
  this.status('Paused');this.mediaState();this.onPlayback(false);
 }
 async resume(){
  if(!this.playing)return this.play();
  try{
   if(this.usingMedia)await this.media.play();
   await this.ctx.resume();this.paused=false;
   this.requeue();clearInterval(this.timer);this.timer=setInterval(()=>this.fill(),750);
   this.mediaState();this.onPlayback(true);this.status('Playing');
  }catch(err){this.status('Resume failed: '+err.message)}
 }
 async stop(){
  this.playing=false;this.paused=false;clearInterval(this.timer);this.timer=null;
  const old=this.ctx;this.ctx=null;
  if(old)try{await old.close()}catch{}
  this.voices=[];
  if(this.media){this.media.pause();this.media.srcObject=null;this.media.remove();this.media=null}
  this.usingMedia=false;this.onPlayback(false);this.status('Stopped');this.mediaState();
 }
}
