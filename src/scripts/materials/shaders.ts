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

  vec4 sampleBlurredDom(vec2 uv,float blurScale){
    vec2 texel=1.0/uCanvasSize;
    vec2 nearOffset=texel*12.0*blurScale;
    vec2 farOffset=texel*24.0*blurScale;
    vec4 color=texture2D(uDomRefraction,uv)*.2;
    color+=texture2D(uDomRefraction,clamp(uv+vec2(nearOffset.x,0.0),vec2(.002),vec2(.998)))*.12;
    color+=texture2D(uDomRefraction,clamp(uv-vec2(nearOffset.x,0.0),vec2(.002),vec2(.998)))*.12;
    color+=texture2D(uDomRefraction,clamp(uv+vec2(0.0,nearOffset.y),vec2(.002),vec2(.998)))*.12;
    color+=texture2D(uDomRefraction,clamp(uv-vec2(0.0,nearOffset.y),vec2(.002),vec2(.998)))*.12;
    color+=texture2D(uDomRefraction,clamp(uv+farOffset,vec2(.002),vec2(.998)))*.08;
    color+=texture2D(uDomRefraction,clamp(uv-farOffset,vec2(.002),vec2(.998)))*.08;
    color+=texture2D(uDomRefraction,clamp(uv+vec2(farOffset.x,-farOffset.y),vec2(.002),vec2(.998)))*.08;
    color+=texture2D(uDomRefraction,clamp(uv+vec2(-farOffset.x,farOffset.y),vec2(.002),vec2(.998)))*.08;
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

    float lowFrequencyNoise=smoothNoise(vScreenUv*uCanvasSize/68.0);
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
    float tintStrength=.07+prismBand*.24+rim*.12;
    vec3 color=mix(neutralFrost,spectralColor,tintStrength);

    float light=max(dot(rimNormal,normalize(vec2(.68,.74))),0.0);
    float shade=max(dot(rimNormal,normalize(vec2(-.68,-.74))),0.0);
    color=mix(color,vec3(.99),pow(rim,2.0)*light*.34);
    color*=1.0-pow(rim,1.55)*shade*.21;

    vec2 refractionOffset=rimNormal*(uRefraction/uCanvasSize)*pow(rim,1.32);
    float embeddedTitleRegion=smoothstep(.58,.66,local.y)*smoothstep(.12,.24,local.x);
    float titleEffectScale=mix(1.0,.5,embeddedTitleRegion);
    vec2 titleRefractionOffset=refractionOffset*titleEffectScale;
    vec2 refractedUv=clamp(vScreenUv-titleRefractionOffset,vec2(.002),vec2(.998));
    vec2 internalUv=clamp(vScreenUv+titleRefractionOffset*.24,vec2(.002),vec2(.998));
    vec4 refractedDom=sampleBlurredDom(refractedUv,titleEffectScale);
    vec4 internalDom=sampleBlurredDom(internalUv,titleEffectScale);
    vec4 bentDom=mix(internalDom,refractedDom,.82);
    float rimTextStrength=bentDom.a*smoothstep(.08,.72,rim);
    float bentTextStrength=mix(rimTextStrength,bentDom.a*.78,embeddedTitleRegion);
    color=mix(color,bentDom.rgb,bentTextStrength*.92);

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

export const resinFragmentShader = `
  precision highp float;
  uniform sampler2D uBump;
  uniform sampler2D uDomRefraction;
  uniform vec2 uTexel;
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
    vec3 lightDirection=normalize(vec3(-.62,.78,1.0));
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
    vec2 textRefractionOffset=slope*vec2(.00105,.000675);
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
