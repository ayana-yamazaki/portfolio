export const stoneVertexShader = `
  varying vec2 vUv;
  varying vec2 vScreenUv;
  varying vec3 vNormal;
  varying vec3 vViewDirection;

  void main(){
    vUv=uv;
    vec4 viewPosition=modelViewMatrix*vec4(position,1.0);
    vec4 clip=projectionMatrix*viewPosition;
    vScreenUv=clip.xy/clip.w*.5+.5;
    vNormal=normalize(normalMatrix*normal);
    vViewDirection=normalize(-viewPosition.xyz);
    gl_Position=clip;
  }
`;

export const stoneFragmentShader = `
  precision highp float;
  uniform sampler2D uAlbedo;
  uniform sampler2D uMicrodetail;
  uniform vec2 uMicrodetailTexel;
  uniform sampler2D uWetMask;
  uniform vec2 uCanvasSize;
  uniform vec3 uTint;
  varying vec2 vUv;
  varying vec2 vScreenUv;
  varying vec3 vNormal;
  varying vec3 vViewDirection;

  float hash(vec2 point){
    point=fract(point*vec2(123.34,456.21));
    point+=dot(point,point+45.32);
    return fract(point.x*point.y);
  }

  float smoothNoise(vec2 point){
    vec2 cell=floor(point);
    vec2 fraction=fract(point);
    fraction=fraction*fraction*(3.0-2.0*fraction);
    return mix(
      mix(hash(cell),hash(cell+vec2(1.0,0.0)),fraction.x),
      mix(hash(cell+vec2(0.0,1.0)),hash(cell+vec2(1.0,1.0)),fraction.x),
      fraction.y
    );
  }

  vec3 softLight(vec3 base,vec3 blend){
    vec3 dark=base-(1.0-2.0*blend)*base*(1.0-base);
    vec3 light=base+(2.0*blend-1.0)*(sqrt(max(base,vec3(0.0)))-base);
    return mix(dark,light,step(vec3(.5),blend));
  }

  void main(){
    vec4 stone=texture2D(uAlbedo,vUv);
    vec3 microdetail=texture2D(uMicrodetail,vUv).rgb;
    stone.rgb=mix(stone.rgb,softLight(stone.rgb,microdetail),.07);

    float detailLeft=texture2D(uMicrodetail,vUv-vec2(uMicrodetailTexel.x,0.0)).r;
    float detailRight=texture2D(uMicrodetail,vUv+vec2(uMicrodetailTexel.x,0.0)).r;
    float detailDown=texture2D(uMicrodetail,vUv-vec2(0.0,uMicrodetailTexel.y)).r;
    float detailUp=texture2D(uMicrodetail,vUv+vec2(0.0,uMicrodetailTexel.y)).r;
    vec2 detailSlope=vec2(detailRight-detailLeft,detailUp-detailDown);
    vec2 texel=1.0/uCanvasSize;
    float core=texture2D(uWetMask,vScreenUv).a;
    vec2 noisePoint=vScreenUv*uCanvasSize/18.0;
    float broadNoise=smoothNoise(noisePoint);
    float mediumNoise=smoothNoise(noisePoint*2.7+vec2(8.4,3.1));
    vec2 flow=vec2(
      smoothNoise(noisePoint+vec2(4.3,1.7))-.5,
      smoothNoise(noisePoint+vec2(1.1,6.8))-.5
    );
    flow/=max(length(flow),.001);
    vec2 perpendicular=vec2(-flow.y,flow.x);
    float reach=1.4+broadNoise*5.2;
    float warped=texture2D(
      uWetMask,
      clamp(vScreenUv+flow*texel*reach,vec2(.001),vec2(.999))
    ).a;
    float lateral=texture2D(
      uWetMask,
      clamp(vScreenUv+perpendicular*texel*(1.0+mediumNoise*3.2),vec2(.001),vec2(.999))
    ).a;
    float downward=texture2D(
      uWetMask,
      clamp(
        vScreenUv+vec2((mediumNoise-.5)*2.2*texel.x,(2.0+broadNoise*6.5)*texel.y),
        vec2(.001),
        vec2(.999)
      )
    ).a;
    float patchGate=smoothstep(.57,.77,broadNoise*.66+mediumNoise*.34);
    float dripNoise=smoothNoise(noisePoint*1.8+vec2(13.7,5.2));
    float dripGate=smoothstep(.72,.89,dripNoise);
    float bleed=max(warped,lateral*.72)*patchGate;
    bleed=max(bleed,downward*dripGate);
    float wet=smoothstep(.035,.42,max(core,bleed*.8));
    float wetEdge=smoothstep(.04,.34,max(bleed-core*.82,0.0));

    vec3 color=stone.rgb*uTint;
    color*=mix(1.0,.7,wet);

    vec3 normal=normalize(vNormal+vec3(-detailSlope.x,-detailSlope.y,0.0)*.52);
    vec3 lightDirection=normalize(vec3(-.32,.44,1.0));
    float microShade=clamp(dot(detailSlope,vec2(-.42,.58)),-.045,.045);
    color*=1.0+microShade*.24;
    vec3 halfVector=normalize(lightDirection+normalize(vViewDirection));
    float alignment=max(dot(normal,halfVector),0.0);
    float roughness=mix(.92,.18,wet);
    float specularPower=mix(18.0,118.0,1.0-roughness);
    float wetHighlight=pow(alignment,specularPower)*wet;
    float broadHighlight=pow(alignment,16.0)*wet*.055;
    vec3 wetLight=vec3(.76,.87,1.0);
    color+=wetLight*(wetHighlight*(.18+wetEdge*.14)+broadHighlight);

    gl_FragColor=vec4(color,stone.a);
    #include <colorspace_fragment>
  }
`;

export const glassVertexShader = `
  varying vec2 vScreenUv;
  varying vec2 vLocalPosition;
  varying vec3 vNormal;
  void main(){
    vec4 clip=projectionMatrix*modelViewMatrix*vec4(position,1.0);
    vScreenUv=clip.xy/clip.w*.5+.5;
    vLocalPosition=position.xy;
    vNormal=normalize(normalMatrix*normal);
    gl_Position=clip;
  }
`;

export const glassFragmentShader = `
  precision highp float;
  uniform sampler2D uDomRefraction;
  uniform sampler2D uGlassTitle;
  uniform vec2 uCanvasSize;
  uniform vec2 uWorldCardSize;
  uniform vec2 uCardSize;
  uniform float uRadius;
  uniform float uRim;
  uniform float uRefraction;
  uniform float uFloorY;
  uniform vec3 uWallColor;
  uniform vec3 uFloorColor;
  varying vec2 vScreenUv;
  varying vec2 vLocalPosition;
  varying vec3 vNormal;

  float sdRoundBox(vec2 p,vec2 b,float r){
    vec2 q=abs(p)-b+r;
    return min(max(q.x,q.y),0.0)+length(max(q,0.0))-r;
  }

  float hash(vec2 p){
    p=fract(p*vec2(123.34,456.21));
    p+=dot(p,p+45.32);
    return fract(p.x*p.y);
  }

  float smoothNoise(vec2 point){
    vec2 cell=floor(point);
    vec2 fraction=fract(point);
    fraction=fraction*fraction*(3.0-2.0*fraction);
    return mix(
      mix(hash(cell),hash(cell+vec2(1.0,0.0)),fraction.x),
      mix(hash(cell+vec2(0.0,1.0)),hash(cell+vec2(1.0,1.0)),fraction.x),
      fraction.y
    );
  }

  float gaussian(float value,float center,float width){
    float distanceFromCenter=(value-center)/width;
    return exp(-distanceFromCenter*distanceFromCenter);
  }

  vec4 sampleBlurredGlassTitle(vec2 uv){
    vec2 texel=1.0/uCanvasSize;
    vec2 nearOffset=texel*3.0;
    vec2 farOffset=texel*6.0;
    vec4 color=texture2D(uGlassTitle,uv)*.48;
    color+=texture2D(uGlassTitle,clamp(uv+vec2(nearOffset.x,0.0),vec2(.002),vec2(.998)))*.1;
    color+=texture2D(uGlassTitle,clamp(uv-vec2(nearOffset.x,0.0),vec2(.002),vec2(.998)))*.1;
    color+=texture2D(uGlassTitle,clamp(uv+vec2(0.0,nearOffset.y),vec2(.002),vec2(.998)))*.1;
    color+=texture2D(uGlassTitle,clamp(uv-vec2(0.0,nearOffset.y),vec2(.002),vec2(.998)))*.1;
    color+=texture2D(uGlassTitle,clamp(uv+farOffset,vec2(.002),vec2(.998)))*.03;
    color+=texture2D(uGlassTitle,clamp(uv-farOffset,vec2(.002),vec2(.998)))*.03;
    color+=texture2D(uGlassTitle,clamp(uv+vec2(farOffset.x,-farOffset.y),vec2(.002),vec2(.998)))*.03;
    color+=texture2D(uGlassTitle,clamp(uv+vec2(-farOffset.x,farOffset.y),vec2(.002),vec2(.998)))*.03;
    return color;
  }

  void main(){
    vec2 local=vLocalPosition/uWorldCardSize+.5;
    vec2 p=(local-.5)*uCardSize;
    vec2 halfSize=uCardSize*.5;
    float d=sdRoundBox(p,halfSize,uRadius);
    float inside=max(-d,0.0);
    float rim=1.0-smoothstep(0.0,uRim,inside);
    float stepSize=.8;
    vec2 gradient=vec2(
      sdRoundBox(p+vec2(stepSize,0),halfSize,uRadius)-sdRoundBox(p-vec2(stepSize,0),halfSize,uRadius),
      sdRoundBox(p+vec2(0,stepSize),halfSize,uRadius)-sdRoundBox(p-vec2(0,stepSize),halfSize,uRadius)
    );
    vec2 rimNormal=gradient/max(length(gradient),.0001);

    float spectrumPosition=clamp(local.x*.68+(1.0-local.y)*.32,0.0,1.0);
    float blueWeight=gaussian(spectrumPosition,.03,.18);
    float greenWeight=gaussian(spectrumPosition,.27,.18);
    float yellowWeight=gaussian(spectrumPosition,.5,.16);
    float orangeWeight=gaussian(spectrumPosition,.72,.17);
    float redWeight=gaussian(spectrumPosition,.96,.2);
    float totalWeight=blueWeight+greenWeight+yellowWeight+orangeWeight+redWeight;
    vec3 spectralColor=(
      vec3(.45,.63,.9)*blueWeight
      +vec3(.48,.79,.64)*greenWeight
      +vec3(.92,.84,.45)*yellowWeight
      +vec3(.94,.61,.34)*orangeWeight
      +vec3(.9,.42,.48)*redWeight
    )/max(totalWeight,.0001);

    vec2 noisePoint=vScreenUv*uCanvasSize/68.0;
    float lowFrequencyNoise=smoothNoise(noisePoint);
    float noiseStep=.12;
    vec2 surfaceWave=vec2(
      smoothNoise(noisePoint+vec2(noiseStep,0.0))-smoothNoise(noisePoint-vec2(noiseStep,0.0)),
      smoothNoise(noisePoint+vec2(0.0,noiseStep))-smoothNoise(noisePoint-vec2(0.0,noiseStep))
    );
    float surfaceScatter=(lowFrequencyNoise-.5)*.009;
    float boundaryBlur=32.0/uCanvasSize.y;
    float floorMask=1.0-smoothstep(
      uFloorY-boundaryBlur,
      uFloorY+boundaryBlur,
      vScreenUv.y
    );
    vec3 blurredBackdrop=mix(uWallColor,uFloorColor,floorMask);
    vec3 neutralFrost=mix(blurredBackdrop,vec3(.955,.958,.95),.55)+surfaceScatter;
    float prismBand=1.0-smoothstep(10.0,105.0,inside);
    float tintStrength=.035+prismBand*.12+rim*.06;
    vec3 color=mix(neutralFrost,spectralColor,tintStrength);

    float light=max(dot(rimNormal,normalize(vec2(.68,.74))),0.0);
    float shade=max(dot(rimNormal,normalize(vec2(-.68,-.74))),0.0);
    color=mix(color,vec3(.99),pow(rim,2.0)*light*.48);
    color*=1.0-pow(rim,1.55)*shade*.21;

    float rearGlint=exp(-pow((local.x*.7+local.y*.3-.87)/.075,2.0));
    rearGlint*=smoothstep(.36,.86,local.y);
    color=mix(color,vec3(.995,1.0,1.0),rearGlint*.13);

    vec2 wavePixels=
      clamp(surfaceWave*18.0,vec2(-4.0),vec2(4.0))
      +vec2(
        sin(local.y*34.0+lowFrequencyNoise*6.0),
        cos(local.x*29.0-lowFrequencyNoise*5.0)
      )*1.25;
    vec2 waveRefractionOffset=wavePixels/uCanvasSize;
    vec2 edgeRefractionOffset=
      rimNormal*(uRefraction/uCanvasSize)*pow(rim,1.32)
      +waveRefractionOffset;
    vec2 textRefractionOffset=
      rimNormal*(10.0/uCanvasSize)*pow(rim,1.5)
      +waveRefractionOffset*.55;
    vec2 refractedUv=clamp(vScreenUv-textRefractionOffset,vec2(.002),vec2(.998));
    vec2 internalUv=clamp(vScreenUv+textRefractionOffset*.2,vec2(.002),vec2(.998));
    vec4 refractedDom=texture2D(uDomRefraction,refractedUv);
    vec4 internalDom=texture2D(uDomRefraction,internalUv);
    vec4 bentDom=mix(internalDom,refractedDom,.74);
    float bentTextStrength=bentDom.a*(.7+smoothstep(.08,.72,rim)*.08);
    vec3 frostedDom=mix(bentDom.rgb,neutralFrost,.42);
    color=mix(color,frostedDom,bentTextStrength*.74);

    vec2 titleRefractionOffset=edgeRefractionOffset*.22;
    vec4 refractedTitle=sampleBlurredGlassTitle(clamp(vScreenUv-titleRefractionOffset,vec2(.002),vec2(.998)));
    vec4 internalTitle=sampleBlurredGlassTitle(clamp(vScreenUv+titleRefractionOffset*.24,vec2(.002),vec2(.998)));
    vec4 embeddedTitle=mix(internalTitle,refractedTitle,.82);
    float embeddedTitleStrength=smoothstep(.01,.56,embeddedTitle.a)*.28;
    color=mix(color,vec3(1.0),embeddedTitleStrength);

    float side=max(max(vNormal.x,0.0),max(-vNormal.y,0.0));
    color*=1.0-side*.16;
    color=mix(color,spectralColor,side*.11);
    float alpha=.88+prismBand*.03+rim*.08;
    alpha=max(alpha,bentTextStrength*.94);
    gl_FragColor=vec4(color,alpha);
  }
`;

export const resinVertexShader = `
  varying vec2 vUv;
  varying vec2 vScreenUv;
  void main(){
    vUv=uv;
    vec4 clip=projectionMatrix*modelViewMatrix*vec4(position,1.0);
    vScreenUv=clip.xy/clip.w*.5+.5;
    gl_Position=clip;
  }
`;

export const milkResinFragmentShader = `
  precision highp float;
  uniform vec2 uCardSize;
  varying vec2 vUv;

  void main(){
    vec2 cardPoint=vUv*uCardSize;
    vec2 holeCenter=vec2(26.0,uCardSize.y-26.0);
    float holeDistance=distance(cardPoint,holeCenter);
    float holeAlpha=smoothstep(9.15,10.45,holeDistance);

    vec3 resinOrange=vec3(1.0,.572549,0.0);
    vec3 resinEdge=vec3(.88,.388775,0.0);
    float verticalLight=mix(.965,1.0,smoothstep(0.0,1.0,vUv.y));
    float edgeDistance=min(min(vUv.x,1.0-vUv.x),min(vUv.y,1.0-vUv.y));
    float edgeBlend=smoothstep(0.0,.12,edgeDistance);
    vec3 color=mix(resinEdge,resinOrange*verticalLight,mix(.72,1.0,edgeBlend));

    float frontSpot=exp(-dot(vUv-vec2(.5,.88),vUv-vec2(.5,.88))/.085);
    color=mix(color,vec3(1.0,.7,.34),frontSpot*.025);

    float leftEdge=1.0-smoothstep(0.0,.018,vUv.x);
    float topEdge=1.0-smoothstep(0.0,.012,1.0-vUv.y);
    float rightEdge=1.0-smoothstep(0.0,.028,1.0-vUv.x);
    float bottomEdge=1.0-smoothstep(0.0,.028,vUv.y);
    color=mix(color,vec3(1.0,.62,.22),(leftEdge*.012+topEdge*.028));
    color=mix(color,resinEdge,rightEdge*.045+bottomEdge*.07);

    float cardTopLine=1.0-smoothstep(0.0,1.35/uCardSize.y,1.0-vUv.y);
    color=mix(color,vec3(1.0,.82,.58),cardTopLine*.34);

    float holeBevel=1.0-smoothstep(10.0,15.0,holeDistance);
    vec2 holeNormal=normalize(cardPoint-holeCenter);
    float holeHighlight=max(dot(holeNormal,normalize(vec2(.7,.7))),0.0);
    float holeShadow=max(dot(holeNormal,normalize(vec2(-.7,-.7))),0.0);
    color=mix(color,vec3(1.0,.65,.24),holeBevel*holeHighlight*.16);
    color*=1.0-holeBevel*(.07+holeShadow*.14);
    float holeLip=1.0-smoothstep(10.0,11.35,holeDistance);
    float holeTopLight=smoothstep(.12,.88,holeNormal.y);
    color=mix(color,vec3(1.0,.86,.66),holeLip*holeTopLight*.62);

    gl_FragColor=vec4(color,holeAlpha);
  }
`;

export const resinFragmentShader = `
  precision highp float;
  uniform sampler2D uBump;
  uniform sampler2D uDomRefraction;
  uniform vec2 uTexel;
  uniform float uTextWaveStrength;
  uniform float uFloorY;
  uniform vec3 uWallColor;
  uniform vec3 uFloorColor;
  varying vec2 vUv;
  varying vec2 vScreenUv;

  void main(){
    float leftHeight=texture2D(uBump,vUv-vec2(uTexel.x,0.0)).r;
    float rightHeight=texture2D(uBump,vUv+vec2(uTexel.x,0.0)).r;
    float downHeight=texture2D(uBump,vUv-vec2(0.0,uTexel.y)).r;
    float upHeight=texture2D(uBump,vUv+vec2(0.0,uTexel.y)).r;
    float centerHeight=texture2D(uBump,vUv).r;
    vec2 slope=vec2(rightHeight-leftHeight,upHeight-downHeight)*10.5;
    vec3 surfaceNormal=normalize(vec3(-slope.x,-slope.y,1.0));
    vec3 lightDirection=normalize(vec3(.62,.78,1.0));
    vec3 halfVector=normalize(lightDirection+vec3(0.0,0.0,1.0));
    float facingLight=max(dot(surfaceNormal,lightDirection),0.0);
    float specularAlignment=max(dot(surfaceNormal,halfVector),0.0);
    float highlight=pow(specularAlignment,72.0);
    float glancingHighlight=pow(specularAlignment,18.0);
    float crest=smoothstep(.58,.82,centerHeight)*facingLight;
    float leftEdge=1.0-smoothstep(0.0,.014,vUv.x);
    float topEdge=1.0-smoothstep(0.0,.0022,1.0-vUv.y);
    float rightEdge=1.0-smoothstep(0.0,.022,1.0-vUv.x);
    float bottomEdge=1.0-smoothstep(0.0,.022,vUv.y);

    float waveDisplacement=slope.y*.026+slope.x*.008;
    float refractedFloorY=uFloorY+waveDisplacement;
    float floorMask=1.0-smoothstep(
      refractedFloorY-.0025,
      refractedFloorY+.0025,
      vScreenUv.y
    );
    vec3 refractedBackdrop=mix(uWallColor,uFloorColor,floorMask);
    vec2 textRefractionOffset=
      slope*vec2(.00105,.000675)*uTextWaveStrength;
    vec4 refractedDom=texture2D(
      uDomRefraction,
      clamp(vScreenUv-textRefractionOffset,vec2(.002),vec2(.998))
    );
    vec4 originalDom=texture2D(
      uDomRefraction,
      clamp(vScreenUv,vec2(.002),vec2(.998))
    );
    refractedBackdrop=mix(refractedBackdrop,refractedDom.rgb,refractedDom.a);
    float boundaryCover=1.0-smoothstep(.018,.058,abs(vScreenUv.y-uFloorY));
    float textCover=max(originalDom.a,refractedDom.a);

    vec3 color=refractedBackdrop;
    color+=vec3(1.0,.985,.94)*(
      highlight*.82
      +glancingHighlight*.19
      +crest*.12
    )*(.32+facingLight*.68);
    float diagonal=vUv.x*.72+vUv.y*.28;
    float areaHighlight=exp(-pow((diagonal-.86)/.065,2.0));
    areaHighlight*=smoothstep(.28,.86,vUv.y);
    color+=vec3(1.0,.99,.96)*areaHighlight*.18;
    color+=vec3(1.0,.995,.97)*leftEdge*.48;
    color+=vec3(1.0,.998,.985)*topEdge*.96;
    color*=1.0-rightEdge*.12-bottomEdge*.2;
    float surfaceAlpha=.08
      +highlight*.5
      +glancingHighlight*.14
      +crest*.07
      +leftEdge*.42
      +topEdge*.82
      +rightEdge*.12
      +bottomEdge*.18;
    float alpha=max(surfaceAlpha,boundaryCover*.98);
    alpha=max(alpha,textCover*.98);
    gl_FragColor=vec4(color,clamp(alpha,0.0,1.0));
  }
`;
