export const glassVertexShader = `
  varying vec2 vScreenUv;
  varying vec3 vNormal;
  void main(){
    vec4 clip=projectionMatrix*modelViewMatrix*vec4(position,1.0);
    vScreenUv=clip.xy/clip.w*.5+.5;
    vNormal=normalize(normalMatrix*normal);
    gl_Position=clip;
  }
`;

export const glassFragmentShader = `
  precision highp float;
  uniform sampler2D uDomRefraction;
  uniform vec2 uCanvasSize;
  uniform vec4 uBounds;
  uniform vec2 uCardSize;
  uniform float uRadius;
  uniform float uRim;
  uniform float uRefraction;
  varying vec2 vScreenUv;
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

  void main(){
    vec2 local=(vScreenUv-uBounds.xy)/(uBounds.zw-uBounds.xy);
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

    float edgeAura=1.0-smoothstep(8.0,105.0,inside);
    float lowFrequencyNoise=smoothNoise(vScreenUv*uCanvasSize/68.0);
    float surfaceScatter=(lowFrequencyNoise-.5)*.009;
    vec3 neutralFrost=vec3(.915,.92,.905)+surfaceScatter;
    float tintStrength=.045+edgeAura*.13;
    vec3 color=mix(neutralFrost,spectralColor,tintStrength);

    float light=max(dot(rimNormal,normalize(vec2(.68,.74))),0.0);
    float shade=max(dot(rimNormal,normalize(vec2(-.68,-.74))),0.0);
    float innerGlow=exp(-pow((inside-18.0)/11.0,2.0));
    color=mix(color,vec3(.99),pow(rim,2.0)*light*.34+innerGlow*light*.1);
    color*=1.0-pow(rim,1.55)*shade*.21;

    vec2 refractionOffset=rimNormal*(uRefraction/uCanvasSize)*pow(rim,1.32);
    vec2 refractedUv=clamp(vScreenUv-refractionOffset,vec2(.002),vec2(.998));
    vec2 internalUv=clamp(vScreenUv+refractionOffset*.24,vec2(.002),vec2(.998));
    vec4 refractedDom=texture2D(uDomRefraction,refractedUv);
    vec4 internalDom=texture2D(uDomRefraction,internalUv);
    vec4 bentDom=mix(internalDom,refractedDom,.82);
    float bentTextStrength=bentDom.a*smoothstep(.08,.72,rim);
    color=mix(color,bentDom.rgb,bentTextStrength*.92);

    float side=max(max(vNormal.x,0.0),max(-vNormal.y,0.0));
    color*=1.0-side*.16;
    color=mix(color,spectralColor,side*.11);
    float alpha=.54+edgeAura*.16+rim*.14;
    alpha=max(alpha,bentTextStrength*.94);
    gl_FragColor=vec4(color,alpha);
  }
`;

export const resinVertexShader = `
  varying vec2 vUv;
  void main(){
    vUv=uv;
    vec4 clip=projectionMatrix*modelViewMatrix*vec4(position,1.0);
    gl_Position=clip;
  }
`;

export const resinFragmentShader = `
  precision highp float;
  uniform vec2 uCanvasSize;
  varying vec2 vUv;

  float hash(vec2 p){
    p=fract(p*vec2(123.34,456.21));
    p+=dot(p,p+34.45);
    return fract(p.x*p.y);
  }

  float sdRoundBox(vec2 p,vec2 b,float r){
    vec2 q=abs(p)-b+r;
    return min(max(q.x,q.y),0.0)+length(max(q,0.0))-r;
  }

  void main(){
    vec2 panelPoint=(vUv-.5)*vec2(1.0,1.5);
    if(sdRoundBox(panelPoint,vec2(.5,.75),.1)>0.0) discard;

    vec3 transmitted=vec3(.9451);
    float micro=(hash(vUv*uCanvasSize*.72)-.5)*.012;
    vec3 milk=vec3(.945,.935,.91);
    vec3 color=mix(transmitted,milk,.46)+micro;

    float diagonal=vUv.x+vUv.y;
    float clearcoat=exp(-pow((diagonal-.6)/.052,2.0))
      *smoothstep(.02,.28,vUv.x)*smoothstep(.02,.3,vUv.y);
    float topLeft=pow(max(1.0-length((vUv-vec2(.12,.12))*1.18),0.0),3.0);
    float edge=1.0-smoothstep(.0,.09,min(min(vUv.x,1.0-vUv.x),min(vUv.y,1.0-vUv.y)));
    color=mix(color,vec3(1.0),clearcoat*.2+topLeft*.11+edge*.055);
    gl_FragColor=vec4(color,1.0);
  }
`;
