export function createAudio() {
  let context, timer, musicBus, next, step = 0;
  const Audio = window.AudioContext || window.webkitAudioContext;
  const chords = [[57,60,64,67],[53,57,60,64],[55,59,62,65],[52,55,59,62]];
  const pattern = [0,2,1,3,2,1,3,2];
  const frequency = note => 440*2**((note-69)/12);

  function unlock() {
    if(!Audio) return;
    try {
      if(!context) {
        context = new Audio();
        musicBus = context.createGain();
        musicBus.gain.value = .46;
        musicBus.connect(context.destination);
      }
      if(context.state!=='running') context.resume().catch(()=>{});
    } catch { context=undefined; }
  }

  function note(pitch, when, duration, volume, type, output) {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.value = frequency(pitch);
    gain.gain.setValueAtTime(.0001,when);
    gain.gain.exponentialRampToValueAtTime(volume,when+.04);
    gain.gain.exponentialRampToValueAtTime(.0001,when+duration);
    osc.connect(gain);
    gain.connect(output);
    osc.start(when);
    osc.stop(when+duration);
  }

  function schedule() {
    if(context.state!=='running') return;
    if(next < context.currentTime) next = context.currentTime+.04;
    while(next < context.currentTime+.14) {
      const chord = chords[Math.floor(step/8)%chords.length];
      note(chord[pattern[step%8]]+12,next,.65,.045,'sine',musicBus);
      if(step%4===0) note(chord[0]-12,next,1.05,.075,'triangle',musicBus);
      if(step%8===0) note(chord[1],next,1.6,.028,'sine',musicBus);
      step++;
      next+=.315;
    }
  }

  return {
    unlock,
    music(enabled) {
      if(!context) return;
      musicBus.gain.setTargetAtTime(enabled?.46:0,context.currentTime,.06);
      if(enabled && !timer) {
        next=context.currentTime+.04;
        timer=setInterval(schedule,85);
        schedule();
      } else if(!enabled && timer) {
        clearInterval(timer);
        timer=null;
      }
    },
    effect(kind) {
      if(context?.state!=='running') return;
      const now=context.currentTime;
      note(kind==='sell'?76:72,now,.17,.055,'sine',context.destination);
      if(kind!=='sell') note(79,now+.1,.36,.043,'triangle',context.destination);
    },
  };
}
