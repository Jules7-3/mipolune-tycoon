import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { businesses } from './economy.js';

const assets = import.meta.env.BASE_URL + 'assets/';
const colors = [0xd6a75f,0xb86c54,0xe1be93,0xa45848,0x649284,0xe2d6be,0xb8c5b4,0xe2dcd0,0xa9b3b7];
const positions = Array.from({length:9},(_,i) => [-11+(i%3)*11,-9+Math.floor(i/3)*9]);
const cube = new T.BoxGeometry();
const cylinder = new T.CylinderGeometry(.5,.5,1,10);
const cone = new T.ConeGeometry(.5,1,12);
const sphere = new T.IcosahedronGeometry(.5,1);

function makeBatch() {
  const parts = new Map();
  const transform = new T.Object3D();
  return {
    part(material,x,y,z,w,h,d,geometry=cube,rotation=0,tilt=0) {
      transform.position.set(x,y,z);
      transform.scale.set(w,h,d);
      transform.rotation.set(0,rotation,tilt);
      transform.updateMatrix();
      if (!parts.has(material)) parts.set(material,[]);
      parts.get(material).push(geometry.clone().applyMatrix4(transform.matrix));
    },
    finish(shadow=true) {
      const group = new T.Group();
      for (const [material, geometries] of parts) {
        const combined = mergeGeometries(geometries);
        geometries.forEach(geometry => geometry.dispose());
        const mesh = new T.Mesh(combined,material);
        mesh.castShadow = shadow;
        mesh.receiveShadow = true;
        group.add(mesh);
      }
      return group;
    },
  };
}

function surface(kind) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  let seed = 391;
  const random = () => ((seed = (Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const image = ctx.createImageData(1024,1024);
  for (let y=0;y<1024;y++) for (let x=0;x<1024;x++) {
    const offset = (y*1024+x)*4;
    const joint = kind === 'stone' && (y%128<4 || (x+Math.floor(y/128)%2*128)%256<4);
    const shade = joint ? 156 : 222+Math.sin(y*.3)*5+random()*28;
    image.data.set([shade,shade,shade,255],offset);
  }
  ctx.putImageData(image,0,0);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function mountCity(host, overlay, onSelect) {
  const renderer = new T.WebGLRenderer({antialias:true,powerPreference:'low-power'});
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  host.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden','true');
  const scene = new T.Scene();
  scene.background = new T.Color(0xa5c8ce);
  scene.fog = new T.FogExp2(0xb5cfce,.009);
  const camera = new T.OrthographicCamera(-20,20,20,-20,.1,180);
  const target = new T.Vector3(0,0,1);
  let angle = .57, distance = 35, quality, frameTime = 0, dirty = true;
  let state, decorKey, suppress = false;
  let selected = 0;
  scene.add(new T.HemisphereLight(0xfff2d8,0x82928e,2.25));
  const sun = new T.DirectionalLight(0xffe4bf,2.75);
  sun.position.set(-28,42,24);
  Object.assign(sun.shadow.camera,{left:-31,right:31,top:30,bottom:-30,near:1,far:100});
  sun.shadow.normalBias = .045;
  sun.shadow.mapSize.set(1024,1024);
  sun.castShadow = true;
  scene.add(sun);
  const material = (color,props={}) => new T.MeshStandardMaterial({color,roughness:.84,...props});
  const stone = surface('stone');
  const plaster = surface('plaster');
  const palette = colors.map(color => material(color,{map:plaster}));
  const trim = material(0xe2d4b7,{map:stone});
  const pavement = material(0xa7a091,{map:stone});
  const roof = material(0x8a4e38,{map:plaster});
  const glass = material(0x355c69,{roughness:.26,metalness:.25,emissive:0x193540,emissiveIntensity:.38});
  const panes = material(0x92b6bf,{roughness:.29});
  const metal = material(0x303e3d,{roughness:.49,metalness:.4});
  const white = material(0xf2e4c6);
  const soil = material(0x9a846a,{map:plaster});
  const grass = material(0x617745,{map:plaster});
  const leaf = material(0x41613e,{flatShading:true});
  const lightLeaf = material(0x67854b,{flatShading:true});
  const timber = material(0x72583e,{map:plaster});
  const road = material(0x868384);
  new T.TextureLoader().load(assets+'asphalt.jpg',texture => {
    texture.colorSpace = T.SRGBColorSpace;
    texture.anisotropy = Math.min(8,renderer.capabilities.getMaxAnisotropy());
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.repeat.set(8,2);
    road.map = texture;
    road.needsUpdate = true;
  });

  const ocean = new T.Mesh(new T.PlaneGeometry(260,260),new T.ShaderMaterial({
    uniforms:{time:{value:0}},
    vertexShader:`varying vec2 point;
      void main(){vec4 world=modelMatrix*vec4(position,1.);point=world.xz;gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader:`uniform float time; varying vec2 point;
      void main(){
        float a=sin(point.x*1.35+point.y*.9+time*1.7);
        float b=sin(point.x*.57-point.y*2.4-time);
        float c=sin(point.x*2.8+point.y*1.7-time*.8);
        float ripple=pow(max(0.,(a+b+c)*.32),4.);
        float shore=clamp((point.y-17.)*.046,0.,1.);
        vec3 water=mix(vec3(.16,.49,.49),vec3(.025,.25,.34),shore);
        float reflection=pow(max(0.,1.-abs(point.x+9.)*.035),2.);
        gl_FragColor=vec4(water+(.13+reflection*.14)*ripple,1.);
      }`,
  }));
  ocean.rotation.x = -Math.PI/2;
  ocean.position.y = -.76;
  scene.add(ocean);

  function tree(batch,x,z,size=1) {
    batch.part(timber,x,.85*size,z,.2*size,1.7*size,.2*size,cylinder);
    batch.part(leaf,x,1.9*size,z,1.55*size,1.65*size,1.55*size,sphere);
    batch.part(lightLeaf,x+.38*size,2.22*size,z-.22*size,.97*size,1.1*size,.89*size,sphere);
  }

  function palm(batch,x,z,size=1) {
    batch.part(timber,x,1.3*size,z,.155*size,2.6*size,.155*size,cylinder,0,.12);
    for(let i=0;i<7;i++) {
      const angle=i*Math.PI*2/7;
      batch.part(i%2?leaf:lightLeaf,x-.15*size+Math.sin(angle)*.49*size,2.55*size,z+Math.cos(angle)*.49*size,
        .32*size,.125*size,1.4*size,sphere,angle,.08);
    }
  }

  const land = makeBatch();
  land.part(soil,0,-.55,-5,67,1,49);
  land.part(pavement,0,-.05,-2,44,.22,40);
  land.part(trim,0,-.26,18,66,.95,1.6);
  land.part(grass,0,.07,-21,61,.15,7);
  for (const z of [-13.5,-4.5,4.5,13.5]) {
    land.part(road,0,.083,z,44,.023,2.7);
    for (let x=-21;x<22;x+=2.6) land.part(white,x,.101,z,1.15,.012,.042);
    for (const x of [-16.4,16.4]) for(let k=0;k<6;k++) land.part(white,x+(k-2.5)*.19,.104,z,.095,.012,2.1);
  }
  for (const x of [-16.5,-5.5,5.5,16.5]) {
    land.part(road,x,.093,-.1,2.3,.022,29.7);
    for (let z=-11;z<14;z+=3) if (![-4.5,4.5,13.5].some(roadZ=>Math.abs(roadZ-z)<1.5)) land.part(white,x,.108,z,.04,.012,1.1);
  }
  for (let x=-30;x<=30;x+=3) {
    land.part(trim,x,.23,17.4,.25,.65,.25);
    land.part(metal,x+1.5,.5,17.4,2.8,.045,.055);
    if (Math.abs(x)%6===0) palm(land,x,15.8,.91);
    tree(land,x,-20.5,.9+(x+30)%7*.06);
  }
  for (const x of [-26,24,28]) {
    land.part(timber,x,-.36,22,2.3,.29,11);
    for(let z=17;z<27;z+=.42) land.part(trim,x,-.195,z,2.31,.025,.032);
    for(let z=18;z<28;z+=3) for(const side of [-1,1]) land.part(timber,x+side*1.08,-.18,z,.22,1.3,.22,cylinder);
  }
  for (let i=0;i<15;i++) {
    const x=-30+i*4.3, z=-25-(i%3)*2, h=2+(i*17%6)*.6;
    land.part(palette[i%5],x,h/2-.1,z,3.3,h,3.4);
    land.part(roof,x-.83,h+.125,z,2.02,.15,3.75,cube,0,.44);
    land.part(roof,x+.83,h+.125,z,2.02,.15,3.75,cube,0,-.44);
    land.part(trim,x+.72,h+.83,z-.72,.36,.75,.37);
    land.part(roof,x+.72,h+1.2,z-.72,.42,.10,.42);
    land.part(glass,x,.57,z+1.72,.59,1.02,.067);
    for (let j=-1;j<=1;j+=2) {
      land.part(glass,x+j*.72,h*.65,z+1.72,.55,.75,.06);
      land.part(trim,x+j*.72,h*.65-.4,z+1.77,.68,.1,.12);
    }
  }
  scene.add(land.finish());

  const loader = new GLTFLoader();
  for (const [name, locations, width] of [
    ['painted_wooden_bench',[[-9,16.2],[0,16.2],[9,16.2]],1.6],
    ['street_lamp_01',[[-14,15.3],[-5,15.3],[5,15.3],[14,15.3]],2.8],
  ]) loader.load(assets+name+'/model.gltf',model => {
    const root = model.scene;
    const bounds = new T.Box3().setFromObject(root);
    const size = bounds.getSize(new T.Vector3());
    const factor = width/(name==='street_lamp_01' ? size.y : size.x);
    for (const [x,z] of locations) {
      const copy = root.clone();
      copy.scale.setScalar(factor);
      copy.position.set(x,.1-bounds.min.y*factor,z);
      copy.traverse(node => { if(node.isMesh) node.castShadow = node.receiveShadow = true; });
      scene.add(copy);
    }
    dirty = true;
  });

  function architecture(i, rank) {
    const batch = makeBatch();
    const p = batch.part;
    p(pavement,0,.12,0,8.2,.16,6);
    if (!rank) {
      p(grass,0,.21,0,6.8,.08,4.8);
      for(const x of [-3.4,3.4]) p(trim,x,.27,0,.12,.06,4.8);
      for(const z of [-2.4,2.4]) p(trim,0,.27,z,6.8,.06,.12);
      tree(batch,-3.4,2.3,.64);
      for(let j=0;j<6;j++) p(j%2?leaf:lightLeaf,2.26-j*.62,.36,-1.77,.56,.32,.58,sphere);
      p(grass,-2.5,.3,.28,1.45,.16,2.05,sphere);
      p(lightLeaf,2.4,.31,1.24,1.26,.24,1.12,sphere);
      return batch.finish();
    }

    const floors = [1,2,2,3,2,6,4,8,4][i]+Math.min(3,Math.floor(Math.log2(rank)));
    const w = i === 0 ? 3.35 : i === 7 ? 4.6 : 5.8;
    const d = i === 0 ? 2.5 : 3.65;
    const h = floors*.91+.52;
    const modern = i>=5;
    p(trim,0,.31,0,w+.42,.3,d+.45);
    p(palette[i],0,h/2+.43,0,w,h,d);
    p(modern?metal:trim,0,h+.53,0,w+.25,.2,d+.24);
    p(modern?glass:roof,0,h+.69,0,w,.13,d);
    for(const x of [-1,1]) p(trim,x*(w/2-.13),h/2+.42,d/2+.07,.23,h,.22);
    p(glass,0,.94,d/2+.075,.75,1.05,.14);
    p(metal,0,.94,d/2+.16,.045,1.05,.055);
    for (const x of [-1,1]) {
      p(glass,x*w*.31,1.02,d/2+.075,w*.25,.78,.13);
      p(trim,x*w*.31,.64,d/2+.17,w*.27,.11,.22);
    }
    for (let f=1;f<floors;f++) {
      const y=.84+f*.91;
      p(trim,0,y-.43,d/2+.025,w,.085,.13);
      for (let j=0;j<4;j++) {
        const x=(j-1.5)*w*.22;
        p(trim,x,y,d/2+.045,w*.16,.66,.1);
        p(glass,x,y,d/2+.105,w*.13,.54,.057);
        p(panes,x-w*.027,y,d/2+.14,.045,.52,.04);
        if (i===3 || i===5) {
          p(trim,x,y-.35,d/2+.18,w*.18,.085,.36);
          p(metal,x,y-.21,d/2+.34,w*.18,.036,.045);
        }
      }
      for(const side of [-1,1]) for(const z of [-1.08,.15,1.28]) {
        p(glass,side*(w/2+.05),y,z,.11,.54,.69);
        p(trim,side*(w/2+.11),y-.31,z,.21,.07,.77);
      }
    }
    if (i<4) {
      for(let j=0;j<12;j++) p(j%2?white:palette[i],(j-5.5)*w/12,1.53,d/2+.42,w/12,.1,.8);
      for(const x of [-1.15,1.15]) {
        p(timber,x,.67,2.5,.61,.08,.61,cylinder);
        p(metal,x,.4,2.5,.07,.48,.07,cylinder);
      }
      const cap = new T.CylinderGeometry(w*.48,w*.66,.8,4,1);
      p(roof,0,h+1.04,0,.92,1,.66,cap,Math.PI/4);
      cap.dispose();
    } else {
      p(metal,-w*.21,h+.87,-.17,w*.27,.3,.75);
      p(panes,w*.22,h+.88,0,w*.29,.28,1.3);
      if(i===7) {
        for (const x of [-2,-1,1,2]) p(trim,x,1.2,d/2+.48,.25,1.72,.25,cylinder);
        p(trim,0,2.12,d/2+.44,w,.22,.85);
      }
      if(i===8) {
        p(white,0,h+1.65,0,.64,1.95,.64,cylinder);
        p(palette[3],0,h+2.89,0,.64,.57,.64,cone);
        p(metal,0,h+.77,0,2.4,.23,2.4,cylinder);
      }
    }
    if(rank>=2) for(const x of [-w*.53,w*.53]) {
      p(trim,x,.33,2.2,.48,.36,.59);
      p(lightLeaf,x,.59,2.2,.46,.43,.56,sphere);
    }
    return batch.finish();
  }

  const lots = positions.map(([x,z],i) => {
    const group = new T.Group();
    group.position.set(x,0,z);
    scene.add(group);
    const button = document.createElement('button');
    button.className = 'marker';
    button.type = 'button';
    button.addEventListener('click',() => onSelect(i));
    overlay.append(button);
    return {group,button,rank:-1,start:0};
  });
  const ring = new T.Mesh(new T.RingGeometry(3.15,3.27,48),
    new T.MeshBasicMaterial({color:0xffd989,side:T.DoubleSide,transparent:true,opacity:.9}));
  ring.rotation.x = -Math.PI/2;
  scene.add(ring);

  function boat(color,size) {
    const batch = makeBatch();
    batch.part(material(color),0,0,0,1.3*size,.38*size,3*size,cylinder);
    batch.part(white,0,.24*size,-.25*size,.86*size,.22*size,1.65*size);
    batch.part(glass,0,.44*size,-.32*size,.61*size,.27*size,.69*size);
    batch.part(metal,0,.74*size,-.38*size,.046,1.18*size,.046,cylinder);
    return batch.finish(false);
  }
  const boats = [boat(0xece1c5,.7),boat(0x438e92,.55),boat(0xc86e50,.65)];
  boats.forEach(model => scene.add(model));
  const cars = [0xb65a43,0xf3dfb3,0x477b7f,0x66854a].map(color => {
    const batch = makeBatch();
    batch.part(material(color),0,.28,0,1.03,.31,.48);
    batch.part(glass,-.03,.47,0,.55,.24,.43);
    for(const x of [-.32,.32]) for(const z of [-.235,.235]) batch.part(metal,x,.16,z,.23,.08,.23,cylinder,0,Math.PI/2);
    const model = batch.finish(false);
    scene.add(model);
    return model;
  });
  const decor = new T.Group();
  scene.add(decor);
  let fountain, yacht;

  function clear(group) {
    group.traverse(node => { if(node.isMesh) node.geometry.dispose(); });
    group.clear();
  }

  function sync(next, index) {
    state = next;
    selected = index;
    for (const [i,lot] of lots.entries()) {
      const rank = state.shops[i]?.rank || 0;
      if (rank!==lot.rank) {
        if (lot.rank===0 && rank>0) lot.start = performance.now();
        lot.rank = rank;
        clear(lot.group);
        lot.group.add(architecture(i,rank));
        dirty = true;
      }
      lot.button.hidden = i!==selected && i>state.shops.length;
      lot.button.textContent = rank ? businesses[i][0] : '+ '+businesses[i][0];
      lot.button.setAttribute('aria-pressed',String(i===selected));
    }
    if (state.decor.join(',')!==decorKey) {
      decorKey = state.decor.join(',');
      clear(decor);
      fountain = yacht = null;
      const batch = makeBatch();
      if(state.decor.includes('garden')) for(let x=-12;x<=12;x+=3.4) palm(batch,x,15,1.28);
      if(state.decor.includes('fountain')) {
        batch.part(trim,0,.2,16,2.15,.35,2.15,cylinder);
        batch.part(panes,0,.397,16,1.9,.065,1.9,cylinder);
        fountain = new T.Mesh(new T.SphereGeometry(.28,10,8),panes);
        fountain.position.set(0,.78,16);
        decor.add(fountain);
      }
      if(state.decor.includes('yacht')) {
        yacht = boat(0xf1e9d1,1.55);
        decor.add(yacht);
      }
      decor.add(batch.finish());
      dirty = true;
    }
    if(quality!==state.cameraQuality) {
      quality = state.cameraQuality;
      renderer.setPixelRatio(Math.min(devicePixelRatio,{low:1,normal:1.45,high:2}[quality]));
      renderer.shadowMap.enabled = quality!=='low';
      for(const node of scene.children) node.traverse(mesh => { if(mesh.isMesh) mesh.material.needsUpdate = true; });
      dirty = true;
      resize();
    }
  }

  function resize() {
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!width || !height) return;
    const aspect = width/height;
    const half = Math.max(14,distance/(2*Math.max(.6,aspect)));
    Object.assign(camera,{left:-half*aspect,right:half*aspect,top:half,bottom:-half});
    camera.updateProjectionMatrix();
    renderer.setSize(width,height);
  }
  new ResizeObserver(resize).observe(host);
  function zoom(factor) {
    distance = T.MathUtils.clamp(distance*factor,14,53);
    resize();
  }
  const pointers = new Map();
  host.addEventListener('pointerdown',event => {
    host.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
  });
  host.addEventListener('pointermove',event => {
    const previous = pointers.get(event.pointerId);
    if(!previous) return;
    const x = event.clientX, y = event.clientY;
    const other = [...pointers].find(([id])=>id!==event.pointerId)?.[1];
    if(other) {
      const old = Math.hypot(other.x-previous.x,other.y-previous.y);
      const current = Math.hypot(other.x-x,other.y-y);
      if(current>8 && old>8) zoom(old/current);
    } else {
      angle -= (x-previous.x)*.005;
      target.z = T.MathUtils.clamp(target.z+(previous.y-y)*.044,-11,14);
    }
    pointers.set(event.pointerId,{x,y});
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture']) host.addEventListener(event,e=>pointers.delete(e.pointerId));
  host.addEventListener('wheel',event=>{event.preventDefault();zoom(event.deltaY>0?1.1:.91);},{passive:false});
  renderer.domElement.addEventListener('webglcontextlost',()=>{suppress=true;});
  renderer.domElement.addEventListener('webglcontextrestored',()=>{suppress=false;dirty=true;});

  const projected = new T.Vector3();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  function animate(now) {
    requestAnimationFrame(animate);
    if(!state || document.hidden || suppress || now-frameTime<(quality==='high'?16:32)) return;
    frameTime=now;
    const t=reduced.matches ? 0 : now*.001;
    ocean.material.uniforms.time.value=t;
    camera.position.set(target.x+Math.sin(angle)*37,34,target.z+Math.cos(angle)*37);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    for(const [i,lot] of lots.entries()) {
      if(lot.start) {
        const elapsed=Math.min(1,(now-lot.start)/490);
        lot.group.scale.y=reduced.matches?1:Math.max(.08,1-(1-elapsed)**3);
        if(elapsed===1) lot.start=0;
        dirty=true;
      }
      projected.set(lot.group.position.x,lot.rank ? ([1,2,2,3,2,6,4,8,4][i]+Math.min(3,Math.floor(Math.log2(lot.rank))))*.91+1.85 : .48,lot.group.position.z).project(camera);
      lot.button.style.left=(projected.x*.5+.5)*100+'%';
      lot.button.style.top=(-projected.y*.5+.5)*100+'%';
    }
    ring.position.set(positions[selected][0],.235,positions[selected][1]);
    boats.forEach((model,i)=>{
      model.position.set(-24+i*22+Math.sin(t*.13+i)*3,-.48+Math.sin(t*1.5+i)*.06,21+(i%2)*8+Math.cos(t*.18+i)*2);
      model.rotation.set(Math.sin(t+i)*.045,t*.04+i,Math.cos(t+i)*.027);
    });
    cars.forEach((model,i)=>{
      model.position.set(((t*(1.2+i*.19)+i*7)%43-21.5)*(i%2?-1:1),.1,-12.92+i*9);
    });
    if(yacht) yacht.position.set(20,-.36+Math.sin(t)*.085,25);
    if(fountain) fountain.scale.set(.67,1.45+Math.sin(t*3)*.35,.67);
    if(dirty) renderer.shadowMap.needsUpdate=true;
    dirty=false;
    renderer.render(scene,camera);
    host.dataset.ready = 'true';
  }
  requestAnimationFrame(animate);
  return {sync,zoom,reset(){angle=.57;target.set(0,0,1);distance=35;resize();}};
}
