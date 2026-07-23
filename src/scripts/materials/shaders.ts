export const gemVertexShader = `
  varying vec2 vScreenUv;
  varying vec2 vUv;
  varying vec3 vViewNormal;
  varying vec3 vViewPosition;

  void main(){
    vec4 viewPosition=modelViewMatrix*vec4(position,1.0);
    vec4 clip=projectionMatrix*viewPosition;
    vScreenUv=clip.xy/clip.w*.5+.5;
    vUv=uv;
    vViewNormal=normalize(normalMatrix*normal);
    vViewPosition=viewPosition.xyz;
    gl_Position=clip;
  }
`;

export const gemFragmentShader = `
  precision highp float;
  uniform sampler2D uBackdrop;
  uniform sampler2D uDomRefraction;
  uniform sampler2D uFloorInteraction;
  uniform samplerCube uEnvironment;
  uniform vec2 uCanvasSize;
  uniform float uIor;
  uniform float uIorRed;
  uniform float uIorGreen;
  uniform float uIorBlue;
  uniform float uRefraction;
  uniform float uDispersionBoost;
  uniform float uRoughness;
  uniform float uEnvironmentIntensity;
  uniform float uReflectionExposure;
  uniform float uFloorY;
  uniform vec3 uLightDirection;
  uniform vec3 uKeyColor;
  uniform float uKeyIntensity;
  varying vec2 vScreenUv;
  varying vec2 vUv;
  varying vec3 vViewNormal;
  varying vec3 vViewPosition;

  vec3 sceneAt(vec2 uv){
    vec4 backdrop=texture2D(uBackdrop,clamp(uv,vec2(.002),vec2(.998)));
    vec4 dom=texture2D(uDomRefraction,clamp(uv,vec2(.002),vec2(.998)));
    return mix(backdrop.rgb,dom.rgb,dom.a);
  }

  vec2 refractionOffset(vec3 normal,vec3 viewDirection,float ior){
    vec3 ray=refract(-viewDirection,normal,1.0/ior);
    vec2 projected=ray.xy/max(abs(ray.z),.22);
    vec2 facetSlope=normal.xy/max(abs(normal.z),.28);
    vec2 direction=mix(facetSlope,projected,.58);
    direction=clamp(direction,vec2(-2.2),vec2(2.2));
    float grazing=1.0-abs(dot(normal,viewDirection));
    float distancePx=uRefraction*(.42+grazing*.88);
    return direction*distancePx/uCanvasSize;
  }

  float distributionGGX(vec3 normal,vec3 halfVector,float roughness){
    float alpha=roughness*roughness;
    float alphaSquared=alpha*alpha;
    float normalHalf=max(dot(normal,halfVector),0.0);
    float denominator=normalHalf*normalHalf*(alphaSquared-1.0)+1.0;
    return alphaSquared/max(3.14159265*denominator*denominator,.00001);
  }

  float geometrySchlickGGX(float normalDirection,float roughness){
    float radius=roughness+1.0;
    float k=radius*radius*.125;
    return normalDirection/max(normalDirection*(1.0-k)+k,.00001);
  }

  float geometrySmith(vec3 normal,vec3 viewDirection,vec3 lightDirection,float roughness){
    float normalView=max(dot(normal,viewDirection),0.0);
    float normalLight=max(dot(normal,lightDirection),0.0);
    return geometrySchlickGGX(normalView,roughness)
      *geometrySchlickGGX(normalLight,roughness);
  }

  vec3 fresnelSchlick(float cosine,vec3 f0){
    return f0+(1.0-f0)*pow(1.0-cosine,5.0);
  }

  float gemGaussian(float value,float center,float width){
    float distanceFromCenter=(value-center)/width;
    return exp(-distanceFromCenter*distanceFromCenter);
  }

  vec3 gemSpectralColor(float position){
    float blueWeight=gemGaussian(position,.02,.18);
    float greenWeight=gemGaussian(position,.25,.17);
    float yellowWeight=gemGaussian(position,.49,.15);
    float orangeWeight=gemGaussian(position,.71,.16);
    float redWeight=gemGaussian(position,.96,.19);
    float totalWeight=blueWeight+greenWeight+yellowWeight+orangeWeight+redWeight;
    return (
      vec3(.38,.62,1.0)*blueWeight
      +vec3(.38,.9,.67)*greenWeight
      +vec3(1.0,.88,.3)*yellowWeight
      +vec3(1.0,.48,.25)*orangeWeight
      +vec3(.95,.3,.57)*redWeight
    )/max(totalWeight,.0001);
  }

  vec3 toneMapReflection(vec3 color){
    color*=uReflectionExposure;
    return clamp(
      (color*(2.51*color+.03))/(color*(2.43*color+.59)+.14),
      0.0,
      1.0
    );
  }

  vec3 addStudioCards(vec3 sampledEnvironment,vec3 reflectionDirection){
    vec3 direction=normalize(reflectionDirection);
    vec3 keyDirection=normalize(vec3(-.45,.78,-.44));
    vec3 stripDirection=normalize(vec3(-.38,.77,-.52));
    vec3 fillDirection=normalize(vec3(-.61,-.25,-.75));
    vec3 flagDirection=normalize(vec3(.52,-.01,-.85));
    float softbox=pow(max(dot(direction,keyDirection),0.0),18.0);
    float strip=pow(max(dot(direction,stripDirection),0.0),110.0);
    float fill=pow(max(dot(direction,fillDirection),0.0),16.0);
    float flag=pow(max(dot(direction,flagDirection),0.0),18.0);
    vec3 environment=sampledEnvironment;
    environment+=vec3(1.0,.985,.95)*(softbox*2.1+strip*6.4);
    environment+=vec3(.72,.82,.9)*fill*.42;
    environment*=1.0-flag*.72;
    return environment;
  }

  void main(){
    vec3 normal=normalize(vViewNormal);
    vec3 viewDirection=normalize(-vViewPosition);
    if(!gl_FrontFacing) normal=-normal;

    float facing=max(dot(normal,viewDirection),.0001);
    float sideMask=smoothstep(.12,.44,1.0-facing);
    float thinRim=pow(1.0-facing,13.0)*sideMask;
    vec2 centerOffset=refractionOffset(normal,viewDirection,uIorGreen);
    vec2 rawRedOffset=refractionOffset(normal,viewDirection,uIorRed);
    vec2 rawBlueOffset=refractionOffset(normal,viewDirection,uIorBlue);
    float dispersionStrength=mix(.7,uDispersionBoost,sideMask);
    vec2 redOffset=centerOffset+(rawRedOffset-centerOffset)*dispersionStrength;
    vec2 blueOffset=centerOffset+(rawBlueOffset-centerOffset)*dispersionStrength;
    vec3 centerSample=sceneAt(vScreenUv+centerOffset);
    vec3 refracted=vec3(
      sceneAt(vScreenUv+redOffset).r,
      centerSample.g,
      sceneAt(vScreenUv+blueOffset).b
    );
    vec2 floorUv=vec2(.082,.057)+vUv*vec2(.75,.833);
    vec4 floorInteraction=texture2D(
      uFloorInteraction,
      clamp(floorUv,vec2(.002),vec2(.998))
    );
    float floorLuminance=dot(floorInteraction.rgb,vec3(.2126,.7152,.0722));
    float floorMask=1.0-smoothstep(
      uFloorY-2.0/uCanvasSize.y,
      uFloorY+2.0/uCanvasSize.y,
      vScreenUv.y
    );
    float floorShadow=clamp(
      floorInteraction.a*(1.0-smoothstep(.3,.72,floorLuminance))*2.0*floorMask,
      0.0,
      1.0
    );
    float floorCaustic=clamp(
      floorInteraction.a*smoothstep(.58,.92,floorLuminance)*1.8*floorMask,
      0.0,
      1.0
    );
    refracted*=1.0-floorShadow*.38;
    refracted+=vec3(1.0,.985,.94)*floorCaustic*.52;

    float f0=pow((uIor-1.0)/(uIor+1.0),2.0);
    vec3 lightDirection=normalize(uLightDirection);
    vec3 halfVector=normalize(lightDirection+viewDirection);
    vec3 reflectionDirection=reflect(-viewDirection,normal);
    vec3 environment=addStudioCards(
      textureCube(uEnvironment,reflectionDirection).rgb*uEnvironmentIntensity,
      reflectionDirection
    );
    vec3 fresnel=fresnelSchlick(facing,vec3(f0));
    float incidenceSine=sqrt(max(1.0-facing*facing,0.0));
    float totalInternalReflection=smoothstep(1.0/uIor-.055,1.0/uIor+.055,incidenceSine);
    float surfaceFresnel=max(fresnel.r,max(fresnel.g,fresnel.b));
    float reflectionLimit=mix(.18,.54,sideMask)+thinRim*.18;
    float reflectionWeight=min(clamp(
      surfaceFresnel+totalInternalReflection*.18,
      0.0,
      .82
    ),reflectionLimit);

    float normalLight=max(dot(normal,lightDirection),0.0);
    float normalHalf=max(dot(normal,halfVector),0.0);
    float distribution=distributionGGX(normal,halfVector,uRoughness);
    float geometry=geometrySmith(normal,viewDirection,lightDirection,uRoughness);
    vec3 directFresnel=fresnelSchlick(normalHalf,vec3(f0));
    vec3 directSpecular=(distribution*geometry*directFresnel)
      /max(4.0*facing*normalLight,.0001);
    float broadRoughness=.14;
    float broadDistribution=distributionGGX(normal,halfVector,broadRoughness);
    float broadGeometry=geometrySmith(normal,viewDirection,lightDirection,broadRoughness);
    vec3 broadSpecular=(broadDistribution*broadGeometry*directFresnel)
      /max(4.0*facing*normalLight,.0001);

    vec3 normalizedReflection=normalize(reflectionDirection);
    vec3 sideStripDirection=normalize(vec3(-.38,.77,-.52));
    vec3 sideKeyDirection=normalize(vec3(-.45,.78,-.44));
    vec3 internalDarkDirection=normalize(vec3(.52,-.01,-.85));
    float sharpSideSpecular=pow(
      max(dot(normalizedReflection,sideStripDirection),0.0),
      190.0
    )*sideMask;
    float secondarySideSpecular=pow(
      max(dot(normalizedReflection,sideKeyDirection),0.0),
      88.0
    )*sideMask;
    float internalDarkAlignment=pow(
      max(dot(normalizedReflection,internalDarkDirection),0.0),
      7.0
    );
    float internalDark=clamp(
      sideMask*totalInternalReflection*(.08+internalDarkAlignment*1.08),
      0.0,
      1.0
    );
    float frontTableMask=smoothstep(.965,.995,facing);
    float glossBoundary=vUv.x-(.08+.56*vUv.y);
    float topLeftLight=clamp((1.0-vUv.x)*.46+vUv.y*.54,0.0,1.0);
    float glossPlane=(1.0-smoothstep(-.006,.006,glossBoundary))
      *frontTableMask*mix(.42,1.0,topLeftLight);
    float glossEdge=(1.0-smoothstep(.003,.009,abs(glossBoundary)))
      *frontTableMask;
    float glossSpectrumPosition=clamp(1.08-vUv.y*1.16,0.0,1.0);
    vec3 glossSpectrum=gemSpectralColor(glossSpectrumPosition);
    vec3 glossPlaneColor=mix(vec3(1.0),glossSpectrum,.72);
    vec3 glossEdgeColor=glossSpectrum;
    float bodySpectrumPosition=clamp(
      normalizedReflection.y*.46+normalizedReflection.x*.2+.5,
      0.0,
      1.0
    );
    vec3 bodySpectrum=gemSpectralColor(bodySpectrumPosition);

    vec3 transmitted=refracted*mix(1.0,.08,internalDark);
    transmitted=mix(transmitted,glossPlaneColor,glossPlane*.09);
    vec3 reflectedLight=environment*reflectionWeight;
    float spectralReflectionStrength=clamp(sideMask*.42+thinRim*.28,0.0,.62);
    reflectedLight=mix(
      reflectedLight,
      reflectedLight*bodySpectrum*1.55,
      spectralReflectionStrength
    );
    reflectedLight+=(directSpecular+broadSpecular*.18)
      *uKeyColor*normalLight*uKeyIntensity;
    vec3 sideHighlightColor=mix(vec3(1.0,.99,.965),bodySpectrum,.72);
    reflectedLight+=sideHighlightColor*(
      sharpSideSpecular*5.8
      +secondarySideSpecular*1.65
    );
    reflectedLight+=mix(vec3(.86,.93,1.0),bodySpectrum,.62)*thinRim*.58;
    reflectedLight+=glossPlaneColor*glossPlane*.12;
    reflectedLight+=glossEdgeColor*glossEdge*.16;
    vec3 color=transmitted*(1.0-reflectionWeight)
      +toneMapReflection(reflectedLight);
    gl_FragColor=vec4(color,1.0);
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
  uniform sampler2D uBackdrop;
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
  uniform vec2 uLightDirection;
  uniform float uGlintStrength;
  uniform float uEdgeGlintWidth;
  uniform float uFaceBandWidth;
  uniform float uCornerBoost;
  varying vec2 vScreenUv;
  varying vec2 vLocalPosition;
  varying vec3 vNormal;

  float sdRoundBox(vec2 p,vec2 b,float r){
    vec2 q=abs(p)-b+r;
    return min(max(q.x,q.y),0.0)+length(max(q,0.0))-r;
  }

  float gaussian(float value,float center,float width){
    float distanceFromCenter=(value-center)/width;
    return exp(-distanceFromCenter*distanceFromCenter);
  }

  vec3 sceneAt(vec2 uv){
    vec4 backdrop=texture2D(uBackdrop,uv);
    float floorMask=1.0-smoothstep(
      uFloorY-1.5/uCanvasSize.y,
      uFloorY+1.5/uCanvasSize.y,
      uv.y
    );
    vec3 base=mix(uWallColor,uFloorColor,floorMask);
    vec3 scene=mix(base,backdrop.rgb,backdrop.a);
    vec4 text=texture2D(uDomRefraction,uv);
    return mix(scene,text.rgb,text.a);
  }

  void main(){
    vec2 local=vLocalPosition/uWorldCardSize+.5;
    vec2 p=(local-.5)*uCardSize;
    vec2 halfSize=uCardSize*.5;
    float d=sdRoundBox(p,halfSize,uRadius);
    float inside=max(-d,0.0);
    float rim=1.0-smoothstep(0.0,uRim,inside);
    float innerBevel=1.0-smoothstep(0.0,uRim*3.2,inside);
    float stepSize=.65;
    vec2 gradient=vec2(
      sdRoundBox(p+vec2(stepSize,0),halfSize,uRadius)-sdRoundBox(p-vec2(stepSize,0),halfSize,uRadius),
      sdRoundBox(p+vec2(0,stepSize),halfSize,uRadius)-sdRoundBox(p-vec2(0,stepSize),halfSize,uRadius)
    );
    vec2 rimNormal=gradient/max(length(gradient),.0001);

    float spectrumPosition=clamp(local.x*.7+(1.0-local.y)*.3,0.0,1.0);
    float blueWeight=gaussian(spectrumPosition,.02,.18);
    float greenWeight=gaussian(spectrumPosition,.25,.17);
    float yellowWeight=gaussian(spectrumPosition,.49,.15);
    float orangeWeight=gaussian(spectrumPosition,.71,.16);
    float redWeight=gaussian(spectrumPosition,.96,.19);
    float totalWeight=blueWeight+greenWeight+yellowWeight+orangeWeight+redWeight;
    vec3 spectralColor=(
      vec3(.38,.62,1.0)*blueWeight
      +vec3(.38,.9,.67)*greenWeight
      +vec3(1.0,.88,.3)*yellowWeight
      +vec3(1.0,.48,.25)*orangeWeight
      +vec3(.95,.3,.57)*redWeight
    )/max(totalWeight,.0001);

    float opticalThickness=pow(innerBevel,1.28);
    vec2 bendPixels=rimNormal*uRefraction*opticalThickness;
    vec2 bend=bendPixels/uCanvasSize;
    vec2 uv=clamp(vScreenUv-bend,vec2(.002),vec2(.998));
    vec2 redUv=clamp(vScreenUv-bend*1.08,vec2(.002),vec2(.998));
    vec2 blueUv=clamp(vScreenUv-bend*.92,vec2(.002),vec2(.998));
    vec3 centerSample=sceneAt(uv);
    vec3 refracted=vec3(sceneAt(redUv).r,centerSample.g,sceneAt(blueUv).b);
    vec3 color=refracted;

    vec2 lightDirection=normalize(uLightDirection);
    float light=max(dot(rimNormal,lightDirection),0.0);
    float shade=max(dot(rimNormal,-lightDirection),0.0);
    float faceMask=smoothstep(uRim*2.8,uRim*5.4,inside);
    float fresnel=pow(innerBevel,.72);
    float topShoulder=exp(-pow((local.y-.91)/.105,2.0))
      *smoothstep(.02,.28,local.x)
      *(1.0-smoothstep(.72,.98,local.x));
    float leftShoulder=exp(-pow((local.x-.075)/.055,2.0))
      *smoothstep(.45,.94,local.y);
    float softbox=topShoulder*.62+leftShoulder*.46;
    color=mix(color,spectralColor,rim*.2+pow(rim,2.0)*.08);
    color=mix(color,vec3(.99,1.0,1.0),fresnel*light*.28+softbox*.24);
    color*=1.0-fresnel*shade*.26;

    float topGlint=pow(max(dot(rimNormal,lightDirection),0.0),28.0);
    float edgeGlint=exp(-pow((inside-uRim*.55)/max(uEdgeGlintWidth,1.0),2.0));
    edgeGlint*=mix(.2,1.0,light);
    vec2 glintAxis=normalize(vec2(lightDirection.y,-lightDirection.x));
    float bandCoordinate=dot(local-vec2(.5),glintAxis);
    float faceBand=exp(-pow((bandCoordinate-.11)/uFaceBandWidth,2.0))*faceMask;
    float cornerGlint=exp(-dot(local-vec2(.13,.87),local-vec2(.13,.87))/.0012);
    color=mix(
      color,
      vec3(.99,1.0,1.0),
      topGlint*innerBevel*(.18+uGlintStrength*.36)
    );
    color+=vec3(1.0,.995,.97)*(
      edgeGlint*uGlintStrength*.22
      +faceBand*uGlintStrength*.08
      +cornerGlint*uCornerBoost*.34
    );
    float directionalFace=dot(local-vec2(.5),lightDirection);
    color*=.985+clamp(directionalFace+.5,0.0,1.0)*.025;
    float broadReflection=exp(-pow((local.x*.72+local.y*.28-.82)/.075,2.0));
    broadReflection*=smoothstep(.3,.9,local.y);
    color=mix(color,vec3(1.0),broadReflection*.045+softbox*.08);

    float side=max(max(vNormal.x,0.0),max(-vNormal.y,0.0));
    color=mix(color,spectralColor,side*.18);
    float alpha=.055+fresnel*.23+rim*.48;
    alpha=max(alpha,softbox*.34+broadReflection*.12);
    alpha=max(alpha,edgeGlint*.56+faceBand*.14+cornerGlint*.62);
    gl_FragColor=vec4(color,alpha);
  }
`;

export const roughGlassVertexShader = `
  varying vec2 vUv;
  varying vec2 vScreenUv;
  void main(){
    vUv=uv;
    vec4 clip=projectionMatrix*modelViewMatrix*vec4(position,1.0);
    vScreenUv=clip.xy/clip.w*.5+.5;
    gl_Position=clip;
  }
`;

export const seaGlassVertexShader = `
  attribute float aOpticalThickness;
  varying vec2 vUv;
  varying vec2 vScreenUv;
  varying vec3 vViewNormal;
  varying vec3 vViewPosition;
  varying float vOpticalThickness;

  void main(){
    vUv=uv;
    vec4 viewPosition=modelViewMatrix*vec4(position,1.0);
    vec4 clip=projectionMatrix*viewPosition;
    vScreenUv=clip.xy/clip.w*.5+.5;
    vViewNormal=normalize(normalMatrix*normal);
    vViewPosition=viewPosition.xyz;
    vOpticalThickness=aOpticalThickness;
    gl_Position=clip;
  }
`;

export const seaGlassFragmentShader = `
  precision highp float;
  uniform sampler2D uBackdrop;
  uniform sampler2D uBackdropBlurred;
  uniform vec2 uCanvasSize;
  uniform float uRefraction;
  uniform vec2 uLightDirection;
  uniform float uGlintStrength;
  varying vec2 vUv;
  varying vec2 vScreenUv;
  varying vec3 vViewNormal;
  varying vec3 vViewPosition;
  varying float vOpticalThickness;

  void main(){
    vec3 normal=normalize(vViewNormal);
    vec3 viewDirection=normalize(-vViewPosition);
    if(!gl_FrontFacing) normal=-normal;
    float facing=abs(dot(normal,viewDirection));
    float grazing=1.0-facing;
    float organicVariation=
      sin(vUv.x*19.0+vUv.y*11.0)*sin(vUv.y*23.0-vUv.x*7.0)*.025;
    float opticalThickness=clamp(
      max(vOpticalThickness,pow(grazing,.72)*.92)+organicVariation,
      .18,
      1.0
    );

    float microNoise=sin(vUv.x*67.0+vUv.y*31.0)*sin(vUv.y*53.0-vUv.x*19.0);
    vec2 refractionDirection=normal.xy;
    refractionDirection+=vec2(microNoise,-microNoise*.63)*.025;
    vec2 broadLens=(vUv-vec2(.5))*.34;
    refractionDirection+=broadLens*smoothstep(.08,.62,opticalThickness);
    float refractionPx=mix(5.0,uRefraction,pow(opticalThickness,.6));
    refractionPx*=.68+grazing*.72;
    vec2 refractedUv=vScreenUv-refractionDirection*refractionPx/uCanvasSize;

    vec2 sampleUv=clamp(refractedUv,vec2(.002),vec2(.998));
    vec4 sharpSample=texture2D(uBackdrop,sampleUv);
    vec4 blurredSample=texture2D(uBackdropBlurred,sampleUv);
    vec3 backdropBase=vec3(.976,.972,.965);
    vec3 sharpScene=mix(backdropBase,sharpSample.rgb,sharpSample.a);
    vec3 blurredScene=mix(backdropBase,blurredSample.rgb,blurredSample.a);
    float blurAmount=mix(.2,1.0,smoothstep(.28,.74,opticalThickness));
    vec3 color=mix(sharpScene,blurredScene,blurAmount);

    float luminance=dot(color,vec3(.2126,.7152,.0722));
    float blueDominance=smoothstep(.04,.32,color.b-max(color.r,color.g));
    color=vec3(luminance)+(color-vec3(luminance))*mix(1.0,1.2,blueDominance);
    color=clamp(color,vec3(0.0),vec3(1.0));
    color=pow(color,vec3(.94));
    float thicknessVeil=pow(smoothstep(.32,1.0,opticalThickness),1.2);
    float milkyVeil=mix(.5,.7,thicknessVeil);
    color=mix(color,vec3(1.0,.998,.99),milkyVeil);

    vec2 lightDirection=normalize(uLightDirection);
    float directionalLight=max(dot(normal.xy,lightDirection),0.0);
    float directionalShade=max(dot(normal.xy,-lightDirection),0.0);
    float fresnel=pow(1.0-facing,2.2);
    float broadHighlight=smoothstep(.22,.9,fresnel)*(.12+uGlintStrength*.09);
    float faceIllumination=.02+directionalLight*.04;
    color=mix(
      color,
      vec3(1.0,.998,.992),
      faceIllumination+broadHighlight+directionalLight*fresnel*.14
    );
    float upperGlow=exp(-pow((vUv.y-.92)/.105,2.0));
    upperGlow*=exp(-pow((vUv.x-.28)/.26,2.0));
    upperGlow*=smoothstep(.35,.88,facing);
    color=mix(color,vec3(1.0,.998,.99),upperGlow*.48);
    color*=1.0-directionalShade*fresnel*.025;

    gl_FragColor=vec4(color,1.0);
  }
`;

export const roughGlassFragmentShader = `
  precision highp float;
  uniform sampler2D uBump;
  uniform sampler2D uBackdrop;
  uniform sampler2D uDomRefraction;
  uniform vec2 uTexel;
  uniform float uRefractionStrength;
  uniform float uFloorY;
  uniform vec3 uWallColor;
  uniform vec3 uFloorColor;
  varying vec2 vUv;
  varying vec2 vScreenUv;

  vec3 sceneAt(vec2 uv){
    uv=clamp(uv,vec2(.002),vec2(.998));
    vec4 backdrop=texture2D(uBackdrop,uv);
    float floorMask=1.0-smoothstep(
      uFloorY-.0025,
      uFloorY+.0025,
      uv.y
    );
    vec3 base=mix(uWallColor,uFloorColor,floorMask);
    vec3 scene=mix(base,backdrop.rgb,backdrop.a);
    vec4 dom=texture2D(uDomRefraction,uv);
    return mix(scene,dom.rgb,dom.a);
  }

  void main(){
    vec2 reliefStep=uTexel*3.0;
    float leftHeight=texture2D(uBump,vUv-vec2(reliefStep.x,0.0)).r;
    float rightHeight=texture2D(uBump,vUv+vec2(reliefStep.x,0.0)).r;
    float downHeight=texture2D(uBump,vUv-vec2(0.0,reliefStep.y)).r;
    float upHeight=texture2D(uBump,vUv+vec2(0.0,reliefStep.y)).r;
    float centerHeight=texture2D(uBump,vUv).r;
    vec2 slope=vec2(rightHeight-leftHeight,upHeight-downHeight)*5.8;
    vec3 surfaceNormal=normalize(vec3(-slope.x,-slope.y,1.0));
    vec3 overheadLight=normalize(vec3(0.0,1.0,.24));
    vec3 halfVector=normalize(overheadLight+vec3(0.0,0.0,1.0));
    float flatLight=overheadLight.z;
    float waveLight=dot(surfaceNormal,overheadLight);
    float waveLighting=clamp((waveLight-flatLight)*2.2,-1.0,1.0);
    float waveHighlight=smoothstep(.035,.48,waveLighting);
    float waveShadow=smoothstep(.025,.5,-waveLighting);
    float waveSpecular=pow(max(dot(surfaceNormal,halfVector),0.0),30.0);
    float neighborHeight=(leftHeight+rightHeight+downHeight+upHeight)*.25;
    float cavityShadow=smoothstep(.018,.13,neighborHeight-centerHeight);
    float crestLight=smoothstep(.025,.14,centerHeight-neighborHeight);

    vec2 refractionOffset=slope*vec2(.0075,.006)*uRefractionStrength;
    float relief=centerHeight-.5;
    vec2 irregularBend=vec2(
      slope.y-slope.x*.35,
      -slope.x-slope.y*.25
    )*relief*.0018*uRefractionStrength;
    refractionOffset+=irregularBend;
    vec2 refractedUv=clamp(
      vScreenUv-refractionOffset,
      vec2(.002),
      vec2(.998)
    );
    vec2 chromaticVector=slope+vec2(.001);
    vec2 chromaticDirection=chromaticVector/max(length(chromaticVector),.0001);
    vec2 chromaticOffset=chromaticDirection*(.00028+length(slope)*.00016);
    vec3 refractedRed=sceneAt(refractedUv+chromaticOffset);
    vec3 refractedGreen=sceneAt(refractedUv);
    vec3 refractedBlue=sceneAt(refractedUv-chromaticOffset);
    vec3 refractedBackdrop=vec3(
      refractedRed.r,
      refractedGreen.g,
      refractedBlue.b
    );
    vec3 color=refractedBackdrop;
    vec2 bottomFaceOffset=vec2(.006,-.018)*(1.0+abs(relief)*.45);
    vec3 bottomFace=sceneAt(refractedUv+bottomFaceOffset+refractionOffset*.22);
    bottomFace=mix(bottomFace,vec3(.84,.91,.93),.12);
    float bottomPlane=1.0-smoothstep(.025,.27,vUv.y);
    float bottomSeam=exp(-pow((vUv.y-.12)/.028,2.0));
    color=mix(color,bottomFace,.16+bottomPlane*.56);
    color*=1.0-bottomSeam*.09;
    color=mix(color,vec3(.985,.99,.99),abs(relief)*.04);
    float blueBackdrop=smoothstep(.06,.28,color.b-max(color.r,color.g));
    float cavityStrength=mix(.19,.3,blueBackdrop);
    color*=1.0-waveShadow*.16-cavityShadow*cavityStrength;
    float whiteReflection=waveHighlight*.13+waveSpecular*.38+crestLight*.07;
    color=mix(color,vec3(1.0,.998,.99),clamp(whiteReflection,0.0,.52));
    gl_FragColor=vec4(color,1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
