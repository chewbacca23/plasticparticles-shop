import * as ToneLib from 'tone';

// ─── Tone.js ────────────────────────────────────────────────────────────────
let toneStarted = false;
let musicLoop   = null;

async function ensureToneStarted() {
  if (toneStarted) return;
  await ToneLib.start();
  toneStarted = true;
}

export const TRACKS = [
  { id: 'island',     label: '🌴 Island Groove' },
  { id: 'jungle',     label: '🥁 Jungle Bongo'  },
  { id: 'space',      label: '🚀 Space Synth'    },
  { id: 'underwater', label: '🫧 Deep Blue'      },
  { id: 'pirate',     label: '🏴‍☠️ Pirate Shanty' },
  // Bonus track — hidden until the passport SPACE world is fully stamped.
  { id: 'starlight', label: '🌟 Starlight Bonus', locked: true, reward: 'track_starlight' },
];

export async function startMusic(trackId = 'island') {
  try {
    await ensureToneStarted();
    const T = ToneLib;
    if (musicLoop) { try { musicLoop.stop(); musicLoop.dispose(); } catch(e){} musicLoop = null; }
    T.getTransport().stop();
    T.getTransport().cancel(0);
    await new Promise(r => setTimeout(r, 100));
    const limiter = new T.Limiter(-6).toDestination();

    if (trackId === 'island') {
      const reverb = new T.Reverb({ decay:2.5, wet:0.3 }).connect(limiter);
      const chorus = new T.Chorus(3,2.5,0.4).connect(reverb).start();
      const bass   = new T.MonoSynth({ oscillator:{type:'triangle'}, envelope:{attack:0.05,decay:0.3,sustain:0.4,release:0.8}, filterEnvelope:{attack:0.05,decay:0.2,sustain:0.5,release:0.8,baseFrequency:200,octaves:2}, volume:-10 }).connect(chorus);
      const lead   = new T.PolySynth(T.Synth, { oscillator:{type:'sine'}, envelope:{attack:0.08,decay:0.4,sustain:0.3,release:1}, volume:-18 }).connect(chorus);
      const pluck  = new T.PluckSynth({ attackNoise:1,dampening:4000,resonance:0.95,volume:-20 }).connect(chorus);
      const hihat  = new T.MetalSynth({ frequency:400,envelope:{attack:0.001,decay:0.05,release:0.01},harmonicity:5.1,modulationIndex:32,resonance:4000,octaves:1.5,volume:-28 }).connect(limiter);
      const kick   = new T.MembraneSynth({ pitchDecay:0.05,octaves:6,envelope:{attack:0.001,decay:0.3,sustain:0,release:0.1},volume:-16 }).connect(limiter);
      const bN=['F2','C2','Bb2','C2','F2','C2','A2','C2'], lN=['F4','A4','C5','F4','Bb4','D5','A4','C5'];
      const ch=[['F3','A3','C4'],['C3','E3','G3'],['Bb2','D3','F3'],['C3','E3','G3']]; let bar=0;
      musicLoop = new T.Sequence((time,step)=>{
        if(step===0||step===4) kick.triggerAttackRelease('C1','8n',time);
        hihat.triggerAttackRelease('16n',time);
        if(step%2===0) bass.triggerAttackRelease(bN[step/2]||'F2','4n',time);
        if(step%2===1) lead.triggerAttackRelease(lN[Math.floor(step/2)]||'F4','8n',time);
        if(step===0){ch[bar%ch.length].forEach((n,i)=>pluck.triggerAttack(n,time+i*0.04));bar++;}
      },[0,1,2,3,4,5,6,7],'8n');
      T.getTransport().bpm.value=82;

    } else if (trackId === 'jungle') {
      const delay=new T.FeedbackDelay('8n',0.2).connect(limiter);
      const b1=new T.MembraneSynth({pitchDecay:0.08,octaves:4,envelope:{attack:0.001,decay:0.4,sustain:0,release:0.1},volume:-12}).connect(limiter);
      const b2=new T.MembraneSynth({pitchDecay:0.05,octaves:3,envelope:{attack:0.001,decay:0.3,sustain:0,release:0.08},volume:-14}).connect(limiter);
      const sh=new T.MetalSynth({frequency:200,envelope:{attack:0.001,decay:0.1,release:0.05},harmonicity:3.1,modulationIndex:16,resonance:2000,octaves:0.8,volume:-26}).connect(limiter);
      const bs=new T.MonoSynth({oscillator:{type:'sine'},envelope:{attack:0.02,decay:0.5,sustain:0.3,release:0.6},volume:-8}).connect(delay);
      const bN=['C2','C2','G2','C2','Eb2','C2','F2','G2'];
      const p1=[1,0,0,1,0,1,0,0,1,0,0,1,0,0,1,0],p2=[0,0,1,0,1,0,0,1,0,1,0,0,1,0,0,1];
      musicLoop=new T.Sequence((time,step)=>{
        if(p1[step]) b1.triggerAttackRelease('G2','16n',time);
        if(p2[step]) b2.triggerAttackRelease('C3','16n',time);
        if(step%4===0) sh.triggerAttackRelease('32n',time);
        if(step%8===0) bs.triggerAttackRelease(bN[step/8]||'C2','4n',time);
      },[...Array(16).keys()],'16n');
      T.getTransport().bpm.value=70;

    } else if (trackId === 'space') {
      const reverb=new T.Reverb({decay:5,wet:0.6}).connect(limiter);
      const phaser=new T.Phaser({frequency:0.5,octaves:3,baseFrequency:400}).connect(reverb);
      const pad=new T.PolySynth(T.Synth,{oscillator:{type:'sawtooth'},envelope:{attack:1.2,decay:0.5,sustain:0.8,release:2},volume:-20}).connect(phaser);
      const arp=new T.Synth({oscillator:{type:'triangle'},envelope:{attack:0.05,decay:0.3,sustain:0.2,release:0.8},volume:-22}).connect(reverb);
      const sub=new T.MonoSynth({oscillator:{type:'sine'},envelope:{attack:0.3,decay:0.4,sustain:0.6,release:1},volume:-10}).connect(limiter);
      const ch=[['A3','C4','E4'],['F3','A3','C4'],['G3','Bb3','D4'],['E3','G3','B3']];
      const aN=['A4','C5','E5','G5','A5','G5','E5','C5'],sN=['A2','F2','G2','E2']; let bar=0;
      musicLoop=new T.Sequence((time,step)=>{
        if(step===0){pad.triggerAttackRelease(ch[bar%ch.length],'2n',time);sub.triggerAttackRelease(sN[bar%sN.length],'2n',time);bar++;}
        arp.triggerAttackRelease(aN[step%aN.length],'16n',time);
      },[...Array(8).keys()],'8n');
      T.getTransport().bpm.value=68;

    } else if (trackId === 'underwater') {
      // Soft, floaty deep-blue pad — slower than space, more submerged.
      const reverb=new T.Reverb({decay:6,wet:0.7}).connect(limiter);
      const filter=new T.Filter(600,'lowpass').connect(reverb);
      const pad=new T.PolySynth(T.Synth,{oscillator:{type:'sine'},envelope:{attack:1.4,decay:0.6,sustain:0.85,release:2.5},volume:-18}).connect(filter);
      const bub=new T.MembraneSynth({pitchDecay:0.2,octaves:2,envelope:{attack:0.01,decay:0.35,sustain:0,release:0.2},volume:-22}).connect(reverb);
      const sub=new T.MonoSynth({oscillator:{type:'triangle'},envelope:{attack:0.4,decay:0.5,sustain:0.7,release:1.4},volume:-12}).connect(limiter);
      const ch=[['D3','F3','A3'],['G2','Bb2','D3'],['C3','Eb3','G3'],['A2','C3','E3']];
      const sN=['D2','G2','C2','A2']; let bar=0;
      musicLoop=new T.Sequence((time,step)=>{
        if(step===0){pad.triggerAttackRelease(ch[bar%ch.length],'2n',time);sub.triggerAttackRelease(sN[bar%sN.length],'2n',time);bar++;}
        if(step===2||step===5) bub.triggerAttackRelease('C3','16n',time);
        if(step===6) bub.triggerAttackRelease('G2','16n',time);
      },[...Array(8).keys()],'8n');
      T.getTransport().bpm.value=58;

    } else if (trackId === 'pirate') {
      const dist=new T.Distortion(0.15).connect(limiter);
      const acc=new T.PolySynth(T.Synth,{oscillator:{type:'sawtooth'},envelope:{attack:0.01,decay:0.1,sustain:0.6,release:0.2},volume:-16}).connect(dist);
      const bs=new T.MonoSynth({oscillator:{type:'square'},envelope:{attack:0.01,decay:0.2,sustain:0.5,release:0.2},volume:-12}).connect(limiter);
      const sn=new T.NoiseSynth({noise:{type:'white'},envelope:{attack:0.001,decay:0.08,sustain:0,release:0.01},volume:-20}).connect(limiter);
      const kk=new T.MembraneSynth({pitchDecay:0.04,octaves:5,envelope:{attack:0.001,decay:0.2,sustain:0,release:0.1},volume:-14}).connect(limiter);
      const mel=['D4','D4','A4','A4','B4','B4','A4',null,'G4','G4','F#4','F#4','E4','E4','D4',null];
      const bN=['D2','A2','G2','A2','D2','A2','G2','A2'],ch=[['D3','F#3','A3'],['A2','E3','A3'],['G2','B2','D3'],['A2','C#3','E3']];
      musicLoop=new T.Sequence((time,step)=>{
        if(mel[step]) acc.triggerAttackRelease(mel[step],'8n',time);
        if(step%2===0) bs.triggerAttackRelease(bN[step/2%bN.length],'8n',time);
        if(step%4===2) sn.triggerAttackRelease('16n',time);
        if(step%8===0){kk.triggerAttackRelease('C1','8n',time);acc.triggerAttackRelease(ch[Math.floor(step/8)%ch.length],'4n',time+0.01);}
      },[...Array(16).keys()],'8n');
      T.getTransport().bpm.value=96;

    } else if (trackId === 'starlight') {
      // Bright, sparkly reward theme — shimmering bells over a warm pad.
      const reverb=new T.Reverb({decay:4,wet:0.45}).connect(limiter);
      const chorus=new T.Chorus(2.5,3,0.5).connect(reverb).start();
      const bell=new T.PolySynth(T.Synth,{oscillator:{type:'triangle'},envelope:{attack:0.005,decay:0.5,sustain:0.1,release:1.2},volume:-16}).connect(chorus);
      const pad=new T.PolySynth(T.Synth,{oscillator:{type:'sine'},envelope:{attack:0.8,decay:0.4,sustain:0.7,release:2},volume:-22}).connect(reverb);
      const spark=new T.PluckSynth({attackNoise:0.8,dampening:5000,resonance:0.9,volume:-18}).connect(reverb);
      const bass=new T.MonoSynth({oscillator:{type:'sine'},envelope:{attack:0.05,decay:0.3,sustain:0.5,release:0.9},volume:-12}).connect(limiter);
      const mel=['C5','E5','G5','B5','C6','G5','E5','G5'];
      const bN=['C3','C3','A2','A2','F2','F2','G2','G2'];
      const ch=[['C4','E4','G4'],['A3','C4','E4'],['F3','A3','C4'],['G3','B3','D4']]; let bar=0;
      musicLoop=new T.Sequence((time,step)=>{
        if(step===0){pad.triggerAttackRelease(ch[bar%ch.length],'2n',time);bar++;}
        if(step%2===0) bass.triggerAttackRelease(bN[step]||'C3','4n',time);
        bell.triggerAttackRelease(mel[step%mel.length],'8n',time);
        if(step%2===1) spark.triggerAttack(mel[(step+2)%mel.length],time);
      },[...Array(8).keys()],'8n');
      T.getTransport().bpm.value=88;
    }
    musicLoop.start(0);
    T.getTransport().start();
  } catch(e){ console.warn('Music error:',e); }
}

export function stopMusic() {
  try {
    if(musicLoop){musicLoop.stop();musicLoop.dispose();musicLoop=null;}
    ToneLib.getTransport().stop();
    toneStarted=false;
  } catch(e){}
}

export async function playSpringSound() {
  try {
    await ensureToneStarted();
    const T=ToneLib, out=new T.Limiter(-4).toDestination();
    const s1=new T.Synth({oscillator:{type:'sine'},envelope:{attack:0.001,decay:0.6,sustain:0,release:0.2},volume:-6}).connect(out);
    const s2=new T.Synth({oscillator:{type:'triangle'},envelope:{attack:0.001,decay:0.4,sustain:0,release:0.1},volume:-14}).connect(out);
    const now=T.now();
    s1.triggerAttack(180,now); s1.frequency.exponentialRampTo(900,0.18,now); s1.triggerRelease(now+0.18);
    s2.triggerAttack(360,now+0.02); s2.frequency.exponentialRampTo(1400,0.12,now+0.02); s2.triggerRelease(now+0.14);
    setTimeout(()=>{try{s1.dispose();s2.dispose();out.dispose();}catch(e){}},1000);
  } catch(e){console.warn('Spring sound error:',e);}
}

export async function playPickupSound() {
  try {
    await ensureToneStarted();
    const T=ToneLib, out=new T.Limiter(-8).toDestination();
    const s=new T.Synth({oscillator:{type:'triangle'},envelope:{attack:0.001,decay:0.18,sustain:0,release:0.08},volume:-18}).connect(out);
    const now=T.now();
    s.triggerAttack(660,now); s.frequency.exponentialRampTo(1320,0.12,now); s.triggerRelease(now+0.14);
    setTimeout(()=>{try{s.dispose();out.dispose();}catch(e){}},500);
  } catch(e){/* non-breaking: ignore pickup sound errors */}
}

// Little celebratory ascending jingle for unlocking a passport milestone reward.
export async function playUnlockSound() {
  try {
    await ensureToneStarted();
    const T=ToneLib, out=new T.Limiter(-6).toDestination();
    const reverb=new T.Reverb({decay:1.6,wet:0.35}).connect(out);
    const bell=new T.Synth({oscillator:{type:'triangle'},envelope:{attack:0.002,decay:0.28,sustain:0.05,release:0.4},volume:-8}).connect(reverb);
    const spark=new T.Synth({oscillator:{type:'sine'},envelope:{attack:0.002,decay:0.2,sustain:0,release:0.3},volume:-14}).connect(reverb);
    const now=T.now(), notes=['C5','E5','G5','C6'];
    notes.forEach((n,i)=>bell.triggerAttackRelease(n,'16n',now+i*0.09));
    spark.triggerAttackRelease('G6','32n',now+notes.length*0.09+0.02);
    setTimeout(()=>{try{bell.dispose();spark.dispose();reverb.dispose();out.dispose();}catch(e){}},1400);
  } catch(e){/* non-breaking: ignore unlock sound errors */}
}

// Soft paper "page-flip" whoosh for opening the passport book. Kept subtle: a
// short filtered noise swish plus a tiny woody tap, mirroring the other SFX guards.
export async function playPageFlipSound() {
  try {
    await ensureToneStarted();
    const T=ToneLib, out=new T.Limiter(-10).toDestination();
    const filter=new T.Filter({type:'bandpass',frequency:1400,Q:0.8}).connect(out);
    const swish=new T.NoiseSynth({noise:{type:'white'},envelope:{attack:0.02,decay:0.16,sustain:0,release:0.05},volume:-20}).connect(filter);
    const tap=new T.MembraneSynth({pitchDecay:0.02,octaves:2,envelope:{attack:0.001,decay:0.09,sustain:0,release:0.05},volume:-22}).connect(out);
    const now=T.now();
    swish.triggerAttackRelease('16n',now);
    filter.frequency.setValueAtTime(900,now); filter.frequency.exponentialRampTo(2600,0.18,now);
    tap.triggerAttackRelease('C3','32n',now+0.14);
    setTimeout(()=>{try{swish.dispose();tap.dispose();filter.dispose();out.dispose();}catch(e){}},700);
  } catch(e){/* non-breaking: ignore page-flip sound errors */}
}

export async function playCubeHitSound() {
  try {
    await ensureToneStarted();
    const T=ToneLib, out=new T.Limiter(-6).toDestination();
    const s=new T.Synth({oscillator:{type:'square'},envelope:{attack:0.001,decay:0.15,sustain:0,release:0.05},volume:-14}).connect(out);
    s.triggerAttackRelease('C5','16n',T.now());
    setTimeout(()=>{try{s.dispose();out.dispose();}catch(e){}},500);
  } catch(e){console.warn('Cube hit sound error:',e);}
}
