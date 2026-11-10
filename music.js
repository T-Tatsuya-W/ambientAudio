// Composition is deliberately independent of the synthesiser.
// Intervals are measured in semitones relative to the progression's reference Hz.
// They can be fractional; ratio or Hz offset notes are also supported.
export const midiToHz = midi => 440 * 2 ** ((midi - 69) / 12);
export function resolvePitch(referenceHz, pitch) {
  if (typeof pitch === 'number') return referenceHz * 2 ** (pitch / 12);
  if (pitch && Number.isFinite(pitch.hz)) return pitch.hz;
  if (pitch && Number.isFinite(pitch.ratio)) return referenceHz * pitch.ratio;
  if (pitch && Number.isFinite(pitch.cents)) return referenceHz * 2 ** (pitch.cents / 1200);
  if (pitch && Number.isFinite(pitch.semitones)) return referenceHz * 2 ** (pitch.semitones / 12);
  if (pitch && Number.isFinite(pitch.offsetHz)) return referenceHz + pitch.offsetHz;
  throw new Error('Unsupported pitch definition');
}
function fromMidi(referenceMidi, names, chords) {
  return {names,rootHz:midiToHz(referenceMidi),drone:false,
    chords:chords.map(notes=>notes.map(m=>m-referenceMidi))};
}
export const progressions = {
  warm:{name:'Warm / major seventh',...fromMidi(48,['Cmaj7','Am7','Fmaj7','Gsus2'],[[48,55,59,64],[45,52,55,60],[41,48,52,57],[43,50,57,62]])},
  dream:{name:'Dreamy / suspended',...fromMidi(48,['Csus2','Am','Fsus2','G5'],[[48,55,60,62],[45,52,57,60],[41,48,55,60],[43,50,55,62]])},
  minor:{name:'Dusky / minor',...fromMidi(45,['Am','Fmaj7','Dm','Em'],[[45,52,57,60],[41,48,52,57],[38,45,50,53],[40,47,52,55]])},
  horizon:{name:'Horizon',...fromMidi(48,['Cmaj7','Gmaj','Am7','Fmaj7','C','Gsus2','Fmaj7','G5'],[[48,55,59,64],[43,50,55,59],[45,52,55,60],[41,48,52,57],[48,55,60,64],[43,50,57,62],[41,48,52,57],[43,50,55,62]])},
  night:{name:'Nightfall',...fromMidi(45,['Am','Fmaj7','Cmaj7','Gmaj','Dm','Fmaj7','Em','Gmaj'],[[45,52,57,60],[41,48,52,57],[48,55,59,64],[43,50,55,59],[38,45,50,53],[41,48,52,57],[40,47,52,55],[43,50,55,59]])},
  floating:{name:'Floating',...fromMidi(48,['Csus2','Am','Fsus2','G5','Em','Am','D5','G5','Csus2','Fsus2','Dm','G5'],[[48,55,60,62],[45,52,57,60],[41,48,55,60],[43,50,55,62],[40,47,52,55],[45,52,57,60],[38,45,50,57],[43,50,55,62],[48,55,60,62],[41,48,55,60],[38,45,53,57],[43,50,55,62]])},
  journey:{name:'Slow journey',...fromMidi(48,['Cmaj7','Am7','Fmaj7','Gmaj','Em','Am','Dm','G5','C','Gmaj','Fmaj7','Am7','Dm','Fmaj7','Gsus2','Cmaj7'],[[48,55,59,64],[45,52,55,60],[41,48,52,57],[43,50,55,59],[40,47,52,55],[45,52,57,60],[38,45,50,53],[43,50,55,62],[48,55,60,64],[43,50,55,59],[41,48,52,57],[45,52,55,60],[38,45,53,57],[41,48,52,57],[43,50,57,62],[48,55,59,64]])},
  // The reference pitch is held continuously, not re-triggered with each chord.
  // Chord intervals exclude zero (the drone), but may include its octave.
  pedal:{name:'Pedal / continuous C drone',rootHz:midiToHz(48),drone:true,
    names:['Cmaj7 / C','Am7 / C','Fmaj7 / C','Gsus2 / C','Em7 / C','Dm7 / C','Fadd9 / C','G5 / C'],
    chords:[[7,11,16],[-3,4,7,12],[-7,4,9,16],[-5,2,7,14],[4,7,11,14],[2,5,9,12],[-7,5,9,14],[-5,2,7,14]]},
  // A deliberately non-12TET demo using fractions of a semitone and ratios.
  micro:{name:'Microtonal drone / 8 steps',rootHz:128,drone:true,
    names:['1:1 atmosphere','7:6 overtone','11:8 colour','9:7 colour','5:4 overtone','13:8 overtone','7:4 colour','Return'],
    chords:[
      [{ratio:1.25},{ratio:1.5},{ratio:1.875}],
      [{ratio:7/6},{ratio:1.4},{ratio:1.75}],
      [{ratio:11/8},{ratio:1.6},{ratio:2}],
      [{ratio:9/7},{ratio:1.5},{ratio:1.8}],
      [{ratio:5/4},{cents:680},{ratio:1.75}],
      [{ratio:13/8},{ratio:1.2},{cents:1080}],
      [{ratio:7/4},{ratio:1.35},{cents:900}],
      [{ratio:1.25},{ratio:1.5},{ratio:2}]
    ]}
};
export function getReferenceHz(palette,rootOverrideHz) {
  const preset=progressions[palette];
  return rootOverrideHz>0 ? rootOverrideHz : preset.rootHz;
}
export function chordFrequencies(palette,index,rootOverrideHz) {
  const p=progressions[palette];if(!p)throw new Error('Unknown progression');
  const rootHz=getReferenceHz(palette,rootOverrideHz);
  return p.chords[index%p.chords.length].map(pitch=>resolvePitch(rootHz,pitch)).filter(f=>Number.isFinite(f)&&f>=20&&f<=10000);
}
