// Infinite, streaming noise generator: no repeating sample buffer or loop seam.
// These colours are creative approximations, not calibrated psychoacoustic spectra.
class ColouredNoiseProcessor extends AudioWorkletProcessor {
 constructor(){
  super();this.colour='pink';this.previous='pink';this.fade=1;
  this.p=[0,0,0,0,0,0,0];this.brown=0;this.low=0;this.prevWhite=0;
  this.port.onmessage=e=>{if(e.data?.colour && e.data.colour!==this.colour){
   this.previous=this.colour;this.colour=e.data.colour;this.fade=0;
  }};
 }
 sample(){
  const w=Math.random()*2-1,p=this.p;
  p[0]=.99886*p[0]+w*.0555179;
  p[1]=.99332*p[1]+w*.0750759;
  p[2]=.969*p[2]+w*.153852;
  p[3]=.8665*p[3]+w*.3104856;
  p[4]=.55*p[4]+w*.5329522;
  p[5]=-.7616*p[5]-w*.016898;
  const pink=(p[0]+p[1]+p[2]+p[3]+p[4]+p[5]+p[6]+w*.5362)*.11;
  p[6]=w*.115926;
  this.brown=Math.max(-1,Math.min(1,(this.brown+w*.025)*.997));
  this.low=this.low*.996+pink*.004;
  const high=w-this.prevWhite*.96;this.prevWhite=w;
  return {white:w*.24,pink,brown:this.brown*.9,
    grey:(w*.14+high*.095+this.brown*.12),
    orange:this.low*4+pink*.12};
 }
 process(inputs,outputs){
  const out=outputs[0],ch=out[0];
  if(!ch)return true;
  for(let i=0;i<ch.length;i++){
   const variants=this.sample();
   const t=this.fade;
   const a=variants[this.previous]??variants.pink;
   const b=variants[this.colour]??variants.pink;
   ch[i]=a*(1-t)+b*t;
   this.fade=Math.min(1,this.fade+1/(sampleRate*.08));
  }
  for(let c=1;c<out.length;c++)out[c].set(ch);
  return true;
 }
}
registerProcessor('coloured-noise',ColouredNoiseProcessor);
