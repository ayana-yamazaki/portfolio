export const gemVertexShader = `
  attribute vec3 aFacetCenter;
  attribute vec3 aFacetBarycentric;
  varying vec2 vScreenUv;
  varying vec2 vUv;
  varying vec3 vViewNormal;
  varying vec3 vViewPosition;
  varying vec3 vFacetBarycentric;
  varying float vFacetScreenX;

  void main(){
    vec4 viewPosition=modelViewMatrix*vec4(position,1.0);
    vec4 clip=projectionMatrix*viewPosition;
    vec4 facetClip=projectionMatrix
      *modelViewMatrix
      *vec4(aFacetCenter,1.0);
    vScreenUv=clip.xy/clip.w*.5+.5;
    vUv=uv;
    vViewNormal=normalize(normalMatrix*normal);
    vViewPosition=viewPosition.xyz;
    vFacetBarycentric=aFacetBarycentric;
    vFacetScreenX=facetClip.x/facetClip.w*.5+.5;
    gl_Position=clip;
  }
`;

export const gemFragmentShader = `
  precision highp float;
  uniform sampler2D uBackdrop;
  // EMBEDDED GLASS: uniform sampler2D uEmbeddedGlass;
  uniform sampler2D uDomRefraction;
  uniform sampler2D uFloorInteraction;
  uniform samplerCube uEnvironment;
  uniform vec2 uCanvasSize;
  uniform float uIor;
  uniform float uIorRed;
  uniform float uIorGreen;
  uniform float uIorBlue;
  uniform float uRefraction;
  uniform float uRefractionScale;
  uniform float uDispersionBoost;
  uniform float uRoughness;
  uniform float uEnvironmentIntensity;
  uniform float uReflectionExposure;
  uniform float uFloorY;
  uniform vec3 uLightDirection;
  uniform vec3 uKeyColor;
  uniform float uKeyIntensity;
  uniform float uInternalShadowStrength;
  uniform float uFacetShadowHardness;
  uniform float uUpperTransmissionStrength;
  uniform float uFacetHighlightStrength;
  uniform float uSettleLightPosition;
  uniform float uSettleLightStrength;
  uniform vec3 uBackgroundReflectionFallback;
  uniform vec3 uBandColor;
  uniform float uBandTopY;
  uniform float uBackgroundReflectionStrength;
  uniform float uBackgroundReflectionRayDistance;
  varying vec2 vScreenUv;
  varying vec2 vUv;
  varying vec3 vViewNormal;
  varying vec3 vViewPosition;
  varying vec3 vFacetBarycentric;
  varying float vFacetScreenX;

  vec3 sceneAt(vec2 uv){
    vec2 sampleUv=clamp(uv,vec2(.002),vec2(.998));
    vec4 backdrop=texture2D(uBackdrop,sampleUv);
    // EMBEDDED GLASS: vec4 embeddedGlass=texture2D(uEmbeddedGlass,sampleUv);
    // EMBEDDED GLASS: backdrop.rgb=mix(backdrop.rgb,embeddedGlass.rgb,embeddedGlass.a);
    vec4 dom=texture2D(uDomRefraction,sampleUv);
    return mix(backdrop.rgb,dom.rgb,dom.a);
  }

  vec2 refractionOffset(vec3 normal,vec3 viewDirection,float ior){
    vec3 ray=refract(-viewDirection,normal,1.0/ior);
    vec2 projected=ray.xy/max(abs(ray.z),.22);
    vec2 facetSlope=normal.xy/max(abs(normal.z),.28);
    vec2 direction=mix(facetSlope,projected,.58);
    direction=clamp(direction,vec2(-2.2),vec2(2.2));
    float grazing=1.0-abs(dot(normal,viewDirection));
    float distancePx=uRefraction
      *uRefractionScale
      *(.42+grazing*.88);
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
    float frontRefractionBoost=mix(1.5873,1.0,sideMask);
    centerOffset*=frontRefractionBoost;
    rawRedOffset*=frontRefractionBoost;
    rawBlueOffset*=frontRefractionBoost;
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
    float reflectionLimit=mix(.18,.38,sideMask)+thinRim*.1;
    float reflectionWeight=min(clamp(
      surfaceFresnel+totalInternalReflection*.18,
      0.0,
      .82
    ),reflectionLimit);

    float normalLight=max(dot(normal,lightDirection),0.0);
    float normalHalf=max(dot(normal,halfVector),0.0);
    float roughnessMix=smoothstep(.005,.25,uRoughness);
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
    vec3 broadEnvironment=(
      textureCube(
        uEnvironment,
        normalize(normalizedReflection+vec3(.28,-.16,.12)*roughnessMix)
      ).rgb
      +textureCube(
        uEnvironment,
        normalize(normalizedReflection+vec3(-.2,.24,-.14)*roughnessMix)
      ).rgb
      +textureCube(
        uEnvironment,
        normalize(normalizedReflection+vec3(.08,-.2,.27)*roughnessMix)
      ).rgb
    )/3.0;
    environment=mix(
      environment,
      broadEnvironment*uEnvironmentIntensity,
      roughnessMix*.72
    );
    vec3 sideStripDirection=normalize(vec3(-.38,.77,-.52));
    vec3 sideKeyDirection=normalize(vec3(-.45,.78,-.44));
    float sharpSideSpecular=pow(
      max(dot(normalizedReflection,sideStripDirection),0.0),
      190.0
    )*sideMask;
    float secondarySideSpecular=pow(
      max(dot(normalizedReflection,sideKeyDirection),0.0),
      88.0
    )*sideMask;
    float opticalPathLength=clamp(1.0/max(facing,.24),1.0,4.2);
    vec3 volumeTransmittance=exp(
      -vec3(.065,.052,.038)*(opticalPathLength-1.0)
    );
    float directFacetLight=.47+normalLight*.53;
    float facetTransmissionLight=mix(
      1.0,
      directFacetLight,
      sideMask*.86
    );
    float brightFacet=smoothstep(
      .5,
      .88,
      max(dot(normal,halfVector),0.0)
    )*smoothstep(.08,.6,normalLight)*sideMask;
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
    float topFacing=smoothstep(.16,.72,normal.y);
    float backgroundFacetAlignment=smoothstep(
      .08,
      .72,
      max(dot(normalizedReflection,sideStripDirection),0.0)
    );
    float reflectionReach=uBackgroundReflectionRayDistance
      *(.62+backgroundFacetAlignment*.58);
    vec2 reflectedBackgroundUv=vec2(
      vScreenUv.x+normalizedReflection.x*reflectionReach*.22,
      vScreenUv.y+reflectionReach
    );
    float reflectedBackgroundOutside=clamp(
      step(reflectedBackgroundUv.x,0.0)
        +step(1.0,reflectedBackgroundUv.x)
        +step(reflectedBackgroundUv.y,0.0)
        +step(1.0,reflectedBackgroundUv.y),
      0.0,
      1.0
    );
    vec4 reflectedBackgroundSample=texture2D(
      uBackdrop,
      clamp(reflectedBackgroundUv,vec2(.002),vec2(.998))
    );
    vec3 reflectedBackground=mix(
      uBackgroundReflectionFallback,
      reflectedBackgroundSample.rgb,
      reflectedBackgroundSample.a
    );
    reflectedBackground=mix(reflectedBackground,uBandColor,.38);
    reflectedBackground=mix(
      reflectedBackground,
      uBackgroundReflectionFallback,
      reflectedBackgroundOutside
    );
    float distanceToBand=max(uBandTopY-vScreenUv.y,0.0);
    float reflectionBand=exp(
      -pow(
        (distanceToBand-reflectionReach*.86)
          /max(reflectionReach*.15,.0001),
        2.0
      )
    );
    float backgroundReflectionPresence=max(
      reflectionBand,
      .18+backgroundFacetAlignment*.42+sideMask*.16
    );
    float backgroundReflectionFacing=mix(
      .3,
      1.0,
      clamp(max(topFacing,sideMask),0.0,1.0)
    );
    float backgroundReflection=backgroundReflectionPresence
      *backgroundReflectionFacing
      *mix(.18,1.0,backgroundFacetAlignment)
      *uBackgroundReflectionStrength;

    vec3 transmitted=refracted
      *volumeTransmittance
      *facetTransmissionLight;
    transmitted=mix(transmitted,glossPlaneColor,glossPlane*.09);
    vec3 reflectedLight=environment*reflectionWeight;
    float spectralReflectionStrength=clamp(sideMask*.42+thinRim*.28,0.0,.62);
    reflectedLight=mix(
      reflectedLight,
      reflectedLight*bodySpectrum*1.55,
      spectralReflectionStrength
    );
    float controllableKeyHighlight=pow(
      max(dot(normal,halfVector),0.0),
      mix(96.0,10.0,roughnessMix)
    )*mix(.35,1.0,normalLight);
    vec3 controllableKeySpecular=clamp(
      directSpecular+broadSpecular*.18,
      vec3(0.0),
      vec3(4.0)
    )+vec3(controllableKeyHighlight*.35);
    reflectedLight+=controllableKeySpecular
      *uKeyColor
      *uKeyIntensity;
    vec3 sideHighlightColor=mix(vec3(1.0,.99,.965),bodySpectrum,.72);
    reflectedLight+=sideHighlightColor*(
      sharpSideSpecular*5.8
      +secondarySideSpecular*1.65
    );
    reflectedLight+=vec3(1.0,.995,.985)*brightFacet*.83;
    reflectedLight+=mix(vec3(.86,.93,1.0),bodySpectrum,.62)*thinRim*.58;
    reflectedLight+=glossPlaneColor*glossPlane*.12;
    reflectedLight+=glossEdgeColor*glossEdge*.16;
    vec3 color=transmitted*(1.0-reflectionWeight)
      +toneMapReflection(reflectedLight);
    color=mix(
      color,
      reflectedBackground,
      clamp(backgroundReflection,0.0,.72)
    );
    vec3 internalFacetLightDirection=normalize(vec3(-.58,.7,.42));
    float facetShadowHalfWidth=mix(
      .5,
      .06,
      clamp(uFacetShadowHardness*.5,0.0,1.0)
    );
    float hardFacetLight=smoothstep(
      .15-facetShadowHalfWidth,
      .15+facetShadowHalfWidth,
      dot(normal,internalFacetLightDirection)
    );
    float upperFacetMask=max(
      smoothstep(.22,.66,normal.y),
      smoothstep(.72,.93,vUv.y)*sideMask
    );
    float hardFacetShadow=(1.0-hardFacetLight)
      *(sideMask*.16+upperFacetMask*.52)
      *uInternalShadowStrength;
    vec3 upperFacetTransmission=refracted
      *volumeTransmittance
      *mix(vec3(.76,.84,.96),vec3(1.04),hardFacetLight);
    float upperTransmissionReveal=upperFacetMask
      *mix(.68,.28,hardFacetLight)
      *uUpperTransmissionStrength;
    color=mix(
      color,
      upperFacetTransmission,
      clamp(upperTransmissionReveal,0.0,.72)
    );
    color*=1.0-clamp(hardFacetShadow,0.0,.72);
    color+=vec3(1.0,.985,.95)
      *upperFacetMask
      *hardFacetLight
      *.1
      *uFacetHighlightStrength;
    vec3 settleGemLightDirection=normalize(vec3(-.38,.78,.62));
    vec3 settleGemHalfVector=normalize(
      settleGemLightDirection+viewDirection
    );
    float settleGemFacetSpecular=pow(
      max(dot(normal,settleGemHalfVector),0.0),
      18.0
    );
    float settleGemFacetPulse=1.0-smoothstep(
      .012,
      .032,
      abs(vFacetScreenX-uSettleLightPosition)
    );
    float settleGemBarycentric=min(
      vFacetBarycentric.x,
      min(vFacetBarycentric.y,vFacetBarycentric.z)
    );
    float settleGemFacetEdge=1.0-smoothstep(
      .025,
      .11,
      settleGemBarycentric
    );
    float settleGemFacetResponse=sideMask
      *(.22+settleGemFacetSpecular*1.56)
      +thinRim*.82;
    float settleGemGlint=settleGemFacetPulse
      *settleGemFacetResponse
      *(.26+settleGemFacetEdge*.74)
      *uSettleLightStrength;
    vec3 settleGemSpectrum=gemSpectralColor(clamp(
      vUv.y*.72+uSettleLightPosition*.28,
      0.0,
      1.0
    ));
    vec3 settleGemColor=mix(
      vec3(1.0,.94,.76),
      settleGemSpectrum,
      .72
    );
    color+=settleGemColor*settleGemGlint*.72;
    color=mix(
      color,
      settleGemColor,
      clamp(settleGemGlint*.28,0.0,.34)
    );
    gl_FragColor=vec4(color,1.0);
    #include <colorspace_fragment>
  }
`;

export const glassVertexShader = `
  attribute float aSurfaceRegion;
  attribute float aBevelProgress;
  attribute float aOpticalThickness;
  varying vec2 vScreenUv;
  varying vec3 vLocalPosition;
  varying vec3 vLocalNormal;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  varying float vSurfaceRegion;
  varying float vBevelProgress;
  varying float vOpticalThickness;

  void main(){
    vec4 worldPosition=modelMatrix*vec4(position,1.0);
    vec4 viewPosition=modelViewMatrix*vec4(position,1.0);
    vec4 clip=projectionMatrix*viewPosition;
    vScreenUv=clip.xy/clip.w*.5+.5;
    vLocalPosition=position;
    vLocalNormal=normal;
    vWorldNormal=normalize(mat3(modelMatrix)*normal);
    vWorldPosition=worldPosition.xyz;
    vSurfaceRegion=aSurfaceRegion;
    vBevelProgress=aBevelProgress;
    vOpticalThickness=aOpticalThickness;
    gl_Position=clip;
  }
`;

export const glassFragmentShader = `
  precision highp float;
  uniform sampler2D uBackdrop;
  // EMBEDDED GLASS: uniform sampler2D uEmbeddedGlass;
  uniform sampler2D uDomRefraction;
  uniform samplerCube uEnvironment;
  uniform vec2 uCanvasSize;
  uniform vec2 uWorldCardSize;
  uniform float uThicknessPx;
  uniform float uRefraction;
  uniform float uIor;
  uniform float uAbsorptionStrength;
  uniform float uDispersionStrength;
  uniform float uFloorY;
  uniform float uBandBottomY;
  uniform vec3 uWallColor;
  uniform vec3 uFloorColor;
  uniform vec2 uLightDirection;
  uniform float uGlintStrength;
  uniform float uSettleLightPosition;
  uniform float uSettleLightStrength;
  uniform vec3 uBackgroundReflectionFallback;
  uniform vec3 uBandColor;
  uniform float uBandTopY;
  uniform float uBackgroundReflectionStrength;
  uniform float uBackgroundReflectionRayDistance;
  varying vec2 vScreenUv;
  varying vec3 vLocalPosition;
  varying vec3 vLocalNormal;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  varying float vSurfaceRegion;
  varying float vBevelProgress;
  varying float vOpticalThickness;

  float gaussian(float value,float center,float width){
    float distanceFromCenter=(value-center)/width;
    return exp(-distanceFromCenter*distanceFromCenter);
  }

  vec3 sceneAt(vec2 uv){
    vec2 sampleUv=clamp(uv,vec2(.002),vec2(.998));
    vec4 backdrop=texture2D(uBackdrop,sampleUv);
    // EMBEDDED GLASS: vec4 embeddedGlass=texture2D(uEmbeddedGlass,sampleUv);
    // EMBEDDED GLASS: backdrop.rgb=mix(backdrop.rgb,embeddedGlass.rgb,embeddedGlass.a);
    float floorMask=1.0-smoothstep(
      uFloorY-1.5/uCanvasSize.y,
      uFloorY+1.5/uCanvasSize.y,
      sampleUv.y
    );
    vec3 base=mix(uWallColor,uFloorColor,floorMask);
    vec3 scene=mix(base,backdrop.rgb,backdrop.a);
    vec4 text=texture2D(uDomRefraction,sampleUv);
    return mix(scene,text.rgb,text.a);
  }

  vec3 safeRefract(vec3 incident,vec3 surfaceNormal,float eta){
    vec3 transmitted=refract(incident,surfaceNormal,eta);
    float hasTransmission=step(.0001,dot(transmitted,transmitted));
    return mix(reflect(incident,surfaceNormal),transmitted,hasTransmission);
  }

  vec2 raySlope(vec3 ray){
    return ray.xy/max(abs(ray.z),.18);
  }

  void main(){
    vec2 local=vLocalPosition.xy/uWorldCardSize+.5;
    vec3 localNormal=normalize(vLocalNormal);
    vec3 worldNormal=normalize(vWorldNormal);
    if(!gl_FrontFacing){
      localNormal=-localNormal;
      worldNormal=-worldNormal;
    }
    float profile=clamp(vSurfaceRegion,0.0,1.0);
    float frontFace=1.0-smoothstep(.015,.09,profile);
    vec2 centered=local-.5;
    float centralField=1.0-smoothstep(
      .37,
      .51,
      max(abs(centered.x),abs(centered.y))
    );
    vec2 bowSlope=centered*vec2(.052,.032)*centralField*frontFace;
    float surfaceRipple=sin(local.x*43.0+local.y*11.0)
      *sin(local.y*37.0-local.x*9.0);
    float crossRipple=sin(local.x*19.0-local.y*31.0);
    float frontRipple=1.0-smoothstep(.08,.42,profile);
    worldNormal=normalize(
      worldNormal
        +vec3(bowSlope,0.0)
        +vec3(surfaceRipple,crossRipple,0.0)*.0065*frontRipple
    );
    vec3 exitNormal=normalize(
      -worldNormal+vec3(-bowSlope*.7,0.0)
    );
    vec3 incident=normalize(vWorldPosition-cameraPosition);
    vec3 viewDirection=-incident;
    float lateralNormal=clamp(vBevelProgress,0.0,1.0);
    float innerShoulder=smoothstep(.025,.12,profile)
      *(1.0-smoothstep(.48,.62,profile));
    float outerShoulder=smoothstep(.24,.48,profile)
      *(1.0-smoothstep(.72,.84,profile));
    float sideMask=smoothstep(.5,.68,profile)
      *(1.0-smoothstep(.9,.985,profile));
    float rearShoulder=smoothstep(.78,.9,profile);
    float facing=clamp(abs(dot(worldNormal,viewDirection)),.06,1.0);
    float grazing=1.0-facing;
    float f0=pow((uIor-1.0)/(uIor+1.0),2.0);
    float fresnel=f0+(1.0-f0)*pow(grazing,5.0);
    float rightSurface=max(localNormal.x,0.0);
    float leftSurface=max(-localNormal.x,0.0);
    float topSurface=max(localNormal.y,0.0);
    float bottomSurface=max(-localNormal.y,0.0);
    float thicknessScale=clamp(uThicknessPx/80.0,.5,1.8);
    float opticalPath=clamp(
      vOpticalThickness*thicknessScale/facing,
      .7,
      3.2
    );

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

    float opticalRegion=clamp(
      frontFace*(.12+centralField*.09)
        +innerShoulder*.72
        +outerShoulder*.96
        +sideMask,
      .08,
      1.0
    );
    float iorSpread=uDispersionStrength*.11;
    vec2 incidentSlope=raySlope(incident);
    float redIor=uIor-iorSpread;
    float blueIor=uIor+iorSpread;
    vec3 redEntry=safeRefract(incident,worldNormal,1.0/redIor);
    vec3 greenEntry=safeRefract(incident,worldNormal,1.0/uIor);
    vec3 blueEntry=safeRefract(incident,worldNormal,1.0/blueIor);
    vec3 redExit=safeRefract(redEntry,exitNormal,redIor);
    vec3 greenExit=safeRefract(greenEntry,exitNormal,uIor);
    vec3 blueExit=safeRefract(blueEntry,exitNormal,blueIor);
    vec2 redBend=(
      (raySlope(redEntry)-incidentSlope)*opticalPath*.78
        +(raySlope(redExit)-incidentSlope)*.38
    )*uRefraction*opticalRegion;
    vec2 greenBend=(
      (raySlope(greenEntry)-incidentSlope)*opticalPath*.78
        +(raySlope(greenExit)-incidentSlope)*.38
    )*uRefraction*opticalRegion;
    vec2 blueBend=(
      (raySlope(blueEntry)-incidentSlope)*opticalPath*.78
        +(raySlope(blueExit)-incidentSlope)*.38
    )*uRefraction*opticalRegion;
    float bandBoundaryProximity=1.0-smoothstep(
      .018,
      .11,
      abs(vScreenUv.y-uBandBottomY)
    );
    float centerLens=1.0-smoothstep(.08,.5,abs(local.x-.5));
    vec2 boundaryBend=vec2(
      0.0,
      -bandBoundaryProximity*centerLens*uRefraction*.34
    );
    redBend+=boundaryBend*1.025;
    greenBend+=boundaryBend;
    blueBend+=boundaryBend*.975;
    vec3 transmitted=vec3(
      sceneAt(vScreenUv+redBend/uCanvasSize).r,
      sceneAt(vScreenUv+greenBend/uCanvasSize).g,
      sceneAt(vScreenUv+blueBend/uCanvasSize).b
    );
    float leftFrontLens=(
      1.0-smoothstep(.018,.16,local.x)
    )*frontFace;
    float botanicalSideLens=clamp(
      leftFrontLens*.82
        +leftSurface*(
          innerShoulder*.64
            +outerShoulder*.96
            +sideMask
        )
        +bottomSurface*sideMask
          *(1.0-smoothstep(.32,.68,local.x))*.48,
      0.0,
      1.0
    );
    vec2 botanicalCurve=vec2(
      -uRefraction*(
        .48
          +leftFrontLens*.72
          +outerShoulder*.38
          +sideMask*.32
      ),
      (local.y-.5)*uRefraction*(
        .28+leftFrontLens*.34
      )
    )*botanicalSideLens;
    vec3 bentBotanical=sceneAt(
      vScreenUv+botanicalCurve/uCanvasSize
    );
    transmitted=mix(
      transmitted,
      bentBotanical,
      botanicalSideLens*(.46+grazing*.24)
    );
    vec2 internalShift=(
      raySlope(reflect(incident,worldNormal))-incidentSlope
    )*uRefraction*opticalPath*.14;
    vec3 internalScene=sceneAt(vScreenUv+internalShift/uCanvasSize);
    float internalReflection=clamp(
      frontFace*.025
        +innerShoulder*.11
        +outerShoulder*.075
        +sideMask*.04,
      0.0,
      .13
    )*(.45+.55*grazing);
    transmitted=mix(transmitted,internalScene,internalReflection);

    vec3 absorptionCoefficient=vec3(.055,.018,.008)
      *uAbsorptionStrength*opticalPath;
    transmitted*=exp(-absorptionCoefficient);
    float negativeFill=rightSurface*(.12+sideMask*.2)
      +bottomSurface*(.17+sideMask*.24)
      +rearShoulder*.08;
    transmitted*=1.0-clamp(negativeFill,0.0,.46);

    vec3 keyDirection=normalize(vec3(uLightDirection,.28));
    vec3 halfVector=normalize(keyDirection+viewDirection);
    float normalHalf=max(dot(worldNormal,halfVector),0.0);
    float broadSpecular=pow(normalHalf,22.0);
    float sharpSpecular=pow(normalHalf,170.0);
    float upperLeftPosition=(
      1.0-smoothstep(.24,.94,local.x)
    )*smoothstep(.32,.96,local.y);
    float upperSide=topSurface*(.38+upperLeftPosition*.62);
    float keyBroad=broadSpecular*(
      upperSide*.72+leftSurface*upperLeftPosition*.28
    );
    float keySharp=sharpSpecular*(
      innerShoulder*.48+outerShoulder*.74+sideMask*.44
    );

    vec3 reflectionRay=reflect(incident,worldNormal);
    vec3 environment=textureCube(uEnvironment,reflectionRay).rgb;
    environment=vec3(1.0)-exp(-environment*.82);
    float reflectionWeight=clamp(
      fresnel*(.62+sideMask*.66+rearShoulder*.22)
        +lateralNormal*.012
        +keyBroad*.12
        +keySharp*.2,
      0.0,
      .72
    );
    vec3 color=mix(transmitted,environment,reflectionWeight);

    float innerRail=gaussian(profile,.18,.055)
      *innerShoulder*upperSide;
    float outerRail=gaussian(profile,.49,.085)
      *outerShoulder*(.45+upperSide*.55);
    float topTaper=smoothstep(.06,.22,local.x)
      *(1.0-smoothstep(.76,.96,local.x));
    float stripBreak=.58+.42*smoothstep(
      -.28,
      .42,
      sin(local.x*24.0+local.y*5.0)
    );
    float topSoftbox=topSurface
      *gaussian(profile,.2,.052)
      *topTaper
      *stripBreak;
    float rightSoftbox=rightSurface
      *gaussian(profile,.47,.1)
      *smoothstep(.48,.88,local.y)
      *(1.0-smoothstep(.91,.99,local.y));
    float diagonalSoftbox=frontFace
      *gaussian(local.x+local.y*.16,.43,.038)
      *smoothstep(.2,.76,local.y)
      *(1.0-smoothstep(.78,.96,local.y))
      *(.5+.5*smoothstep(-.1,.5,sin(local.y*38.0)));
    float frontWindow=frontFace
      *gaussian(local.x,.27,.25)
      *smoothstep(.01,.48,local.y)
      *(1.0-smoothstep(.52,.99,local.y))
      *(.94+.06*smoothstep(-.5,.75,sin(local.y*13.0+1.1)));
    float windowMullion=frontFace
      *gaussian(local.x,.39,.018)
      *smoothstep(.24,.42,local.y)
      *(1.0-smoothstep(.66,.82,local.y));
    float lightStrength=clamp(uGlintStrength*.34,0.0,1.2);
    color+=vec3(1.0,.995,.975)*(
      keyBroad*.26
        +keySharp*.46
        +innerRail*.14
        +outerRail*.11
        +topSoftbox*.3
        +rightSoftbox*.12
        +diagonalSoftbox*.1
        +frontWindow*.07
        +windowMullion*.045
    )*lightStrength;
    float coolInnerContour=innerShoulder
      *(leftSurface*.32+rightSurface*.5+topSurface*.18)
      *(.45+.55*grazing);
    color=mix(
      color,
      vec3(.66,.84,.94),
      clamp(coolInnerContour*.1,0.0,.085)
    );
    float rearContour=gaussian(profile,.9,.052)
      *rearShoulder
      *(leftSurface*.34+rightSurface*.52+bottomSurface*.44);
    color*=1.0-clamp(rearContour*.13,0.0,.1);

    float spectralStrength=clamp(
      uDispersionStrength*opticalPath*(
        innerShoulder*.08
          +outerShoulder*.18
          +sideMask*.3
          +bottomSurface*.12
      )*(.45+grazing*.55),
      0.0,
      .038
    );
    color=mix(color,spectralColor,spectralStrength);

    float distanceToUpperBackground=max(uBandTopY-vScreenUv.y,0.0);
    float upperBackgroundReach=uBackgroundReflectionRayDistance
      *(1.0+rightSurface*2.45+max(reflectionRay.y,0.0)*.22);
    float upperBackgroundBand=1.0-smoothstep(
      upperBackgroundReach*.7,
      upperBackgroundReach,
      distanceToUpperBackground
    );
    float upperPosition=smoothstep(.48,.96,local.y);
    float topReflector=topSurface*(
      .58+innerShoulder*.28+outerShoulder*.36+sideMask*.22
    );
    float rightReflector=rightSurface*(
      innerShoulder*.22+outerShoulder*.56+sideMask*.86
    )*(.42+upperPosition*.58);
    float upperBackgroundReflection=clamp(
      upperBackgroundBand
        *(topReflector+rightReflector)
        *uBackgroundReflectionStrength,
      0.0,
      .68
    );
    color=mix(
      color,
      mix(uBandColor,vec3(1.0),.08),
      upperBackgroundReflection
    );
    float settleGlassBand=exp(
      -pow((vScreenUv.x-uSettleLightPosition)/.032,2.0)
    );
    float settleGlassUpperEdge=smoothstep(.62,.9,local.y);
    float settleGlassEdge=topSurface
      *(innerShoulder*.52+outerShoulder+sideMask*.72)
      *settleGlassUpperEdge;
    float settleGlassGlint=settleGlassBand
      *settleGlassEdge
      *uSettleLightStrength;
    color+=vec3(1.0,.965,.82)*settleGlassGlint*.48;

    gl_FragColor=vec4(clamp(color,vec3(0.0),vec3(1.0)),1.0);
    #include <colorspace_fragment>
  }
`;

export const roughGlassVertexShader = `
  varying vec2 vUv;
  varying vec2 vScreenUv;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying vec3 vWorldTangent;
  varying vec3 vWorldBitangent;

  void main(){
    vUv=uv;
    vec4 worldPosition=modelMatrix*vec4(position,1.0);
    vec4 clip=projectionMatrix*viewMatrix*worldPosition;
    vScreenUv=clip.xy/clip.w*.5+.5;
    vWorldPosition=worldPosition.xyz;
    vWorldNormal=normalize(mat3(modelMatrix)*normal);
    vWorldTangent=normalize(mat3(modelMatrix)*vec3(1.0,0.0,0.0));
    vWorldBitangent=normalize(mat3(modelMatrix)*vec3(0.0,1.0,0.0));
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
  // EMBEDDED GLASS: uniform sampler2D uEmbeddedGlass;
  uniform sampler2D uDomRefraction;
  uniform vec2 uCanvasSize;
  uniform float uRefraction;
  uniform float uRefractionScale;
  uniform float uBlurStrength;
  uniform float uVeilStrength;
  uniform float uSurfaceNoiseStrength;
  uniform float uSpectralStrength;
  uniform vec2 uLightDirection;
  uniform float uGlintStrength;
  uniform float uSettleLightPosition;
  uniform float uSettleLightStrength;
  uniform vec3 uBackgroundReflectionFallback;
  uniform vec3 uBandColor;
  uniform float uBandTopY;
  uniform float uBackgroundReflectionStrength;
  uniform float uBackgroundReflectionRayDistance;
  varying vec2 vUv;
  varying vec2 vScreenUv;
  varying vec3 vViewNormal;
  varying vec3 vViewPosition;
  varying float vOpticalThickness;

  float seaGlassGaussian(float value,float center,float width){
    float distanceFromCenter=(value-center)/width;
    return exp(-distanceFromCenter*distanceFromCenter);
  }

  vec3 seaGlassSpectralColor(float position){
    float blueWeight=seaGlassGaussian(position,.02,.18);
    float greenWeight=seaGlassGaussian(position,.25,.17);
    float yellowWeight=seaGlassGaussian(position,.49,.15);
    float orangeWeight=seaGlassGaussian(position,.71,.16);
    float redWeight=seaGlassGaussian(position,.96,.19);
    float totalWeight=blueWeight+greenWeight+yellowWeight+orangeWeight+redWeight;
    return (
      vec3(.38,.62,1.0)*blueWeight
      +vec3(.38,.9,.67)*greenWeight
      +vec3(1.0,.88,.3)*yellowWeight
      +vec3(1.0,.48,.25)*orangeWeight
      +vec3(.95,.3,.57)*redWeight
    )/max(totalWeight,.0001);
  }

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

    float microNoise=sin(vUv.x*67.0+vUv.y*31.0)
      *sin(vUv.y*53.0-vUv.x*19.0)
      *uSurfaceNoiseStrength;
    vec2 refractionDirection=normal.xy;
    refractionDirection+=vec2(microNoise,-microNoise*.63)*.025;
    vec2 broadLens=(vUv-vec2(.5))*.34;
    refractionDirection+=broadLens*smoothstep(.08,.62,opticalThickness);
    float refractionPx=mix(5.0,uRefraction,pow(opticalThickness,.6))
      *uRefractionScale;
    refractionPx*=.68+grazing*.72;
    vec2 refractedUv=vScreenUv-refractionDirection*refractionPx/uCanvasSize;

    vec2 sampleUv=clamp(refractedUv,vec2(.002),vec2(.998));
    vec4 sharpSample=texture2D(uBackdrop,sampleUv);
    vec4 blurredSample=texture2D(uBackdropBlurred,sampleUv);
    // EMBEDDED GLASS: vec4 embeddedGlass=texture2D(uEmbeddedGlass,sampleUv);
    vec2 domBlurStep=vec2(2.5)/uCanvasSize;
    vec4 domSample=texture2D(uDomRefraction,sampleUv)*.4;
    domSample+=texture2D(uDomRefraction,sampleUv+vec2(domBlurStep.x,0.0))*.15;
    domSample+=texture2D(uDomRefraction,sampleUv-vec2(domBlurStep.x,0.0))*.15;
    domSample+=texture2D(uDomRefraction,sampleUv+vec2(0.0,domBlurStep.y))*.15;
    domSample+=texture2D(uDomRefraction,sampleUv-vec2(0.0,domBlurStep.y))*.15;
    vec3 backdropBase=vec3(.976,.972,.965);
    vec3 sharpScene=mix(backdropBase,sharpSample.rgb,sharpSample.a);
    vec3 blurredScene=mix(backdropBase,blurredSample.rgb,blurredSample.a);
    // EMBEDDED GLASS: sharpScene=mix(sharpScene,embeddedGlass.rgb,embeddedGlass.a);
    // EMBEDDED GLASS: blurredScene=mix(
    // EMBEDDED GLASS:   blurredScene,
    // EMBEDDED GLASS:   embeddedGlass.rgb,
    // EMBEDDED GLASS:   embeddedGlass.a*.82
    // EMBEDDED GLASS: );
    sharpScene=mix(sharpScene,domSample.rgb,domSample.a);
    blurredScene=mix(blurredScene,domSample.rgb,domSample.a*.72);
    float blurAmount=clamp(
      mix(.2,1.0,smoothstep(.28,.74,opticalThickness))
        *uBlurStrength,
      0.0,
      1.0
    );
    vec3 color=mix(sharpScene,blurredScene,blurAmount);

    float luminance=dot(color,vec3(.2126,.7152,.0722));
    float blueDominance=smoothstep(.04,.32,color.b-max(color.r,color.g));
    color=vec3(luminance)+(color-vec3(luminance))*mix(1.0,1.2,blueDominance);
    color=clamp(color,vec3(0.0),vec3(1.0));
    color=pow(color,vec3(.94));
    float thicknessVeil=pow(smoothstep(.32,1.0,opticalThickness),1.2);
    float milkyVeil=clamp(
      mix(.5,.7,thicknessVeil)*uVeilStrength,
      0.0,
      .94
    );
    color=mix(color,vec3(1.0,.998,.99),milkyVeil);

    vec2 lightDirection=normalize(uLightDirection);
    float directionalLight=max(dot(normal.xy,lightDirection),0.0);
    float directionalShade=max(dot(normal.xy,-lightDirection),0.0);
    float fresnel=pow(1.0-facing,2.2);
    vec3 topPanelRay=reflect(-viewDirection,normal);
    float spectrumPosition=clamp(
      topPanelRay.y*.46+topPanelRay.x*.2+.5+organicVariation*1.4,
      0.0,
      1.0
    );
    float topBlue=smoothstep(.12,.92,vUv.y);
    float bottomPink=smoothstep(.12,.92,1.0-vUv.y);
    spectrumPosition=mix(spectrumPosition,.02,topBlue*.82);
    spectrumPosition=mix(spectrumPosition,.96,bottomPink*.82);
    vec3 spectralColor=seaGlassSpectralColor(spectrumPosition);
    float spectralSweep=exp(
      -pow((vUv.x-(.16+vUv.y*.68))/.16,2.0)
    )*smoothstep(.2,.9,opticalThickness);
    float spectralStrength=clamp(
      (fresnel*.52+spectralSweep*.32)
        *uSpectralStrength
        *mix(.88,1.18,bottomPink),
      0.0,
      .38
    );
    float topFacing=smoothstep(.14,.68,normal.y);
    float reflectionReach=uBackgroundReflectionRayDistance
      *(.9+max(topPanelRay.y,0.0)*.1)
      +microNoise*.008;
    vec2 reflectedBackgroundUv=vec2(
      vScreenUv.x
        +topPanelRay.x*reflectionReach*.2
        +microNoise*.006,
      vScreenUv.y+reflectionReach
    );
    float reflectedBackgroundOutside=clamp(
      step(reflectedBackgroundUv.x,0.0)
        +step(1.0,reflectedBackgroundUv.x)
        +step(reflectedBackgroundUv.y,0.0)
        +step(1.0,reflectedBackgroundUv.y),
      0.0,
      1.0
    );
    vec2 reflectedSampleUv=clamp(
      reflectedBackgroundUv,
      vec2(.002),
      vec2(.998)
    );
    vec4 reflectedSharpSample=texture2D(uBackdrop,reflectedSampleUv);
    vec4 reflectedBlurredSample=texture2D(
      uBackdropBlurred,
      reflectedSampleUv
    );
    vec3 reflectedSharp=mix(
      uBackgroundReflectionFallback,
      reflectedSharpSample.rgb,
      reflectedSharpSample.a
    );
    vec3 reflectedBlurred=mix(
      uBackgroundReflectionFallback,
      reflectedBlurredSample.rgb,
      reflectedBlurredSample.a
    );
    vec3 reflectedBackground=mix(reflectedSharp,reflectedBlurred,.78);
    reflectedBackground=mix(reflectedBackground,uBandColor,.34);
    reflectedBackground=mix(
      reflectedBackground,
      uBackgroundReflectionFallback,
      reflectedBackgroundOutside
    );
    float distanceToBand=max(uBandTopY-vScreenUv.y,0.0);
    float reflectionBand=1.0-smoothstep(
      reflectionReach*.72,
      reflectionReach,
      distanceToBand
    );
    float backgroundReflection=topFacing
      *reflectionBand
      *uBackgroundReflectionStrength;
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
    color=mix(
      color,
      reflectedBackground,
      clamp(backgroundReflection,0.0,.62)
    );
    vec3 spectralTint=mix(vec3(1.0),spectralColor,.68);
    color*=mix(vec3(1.0),spectralTint,spectralStrength);
    color+=spectralColor*spectralStrength*.065;
    color*=1.0-directionalShade*fresnel*.025;
    float settleSeaTopSurface=smoothstep(.04,.56,normal.y);
    float settleSeaGlow=exp(
      -pow((vScreenUv.x-uSettleLightPosition)/.05,2.0)
    )*settleSeaTopSurface*uSettleLightStrength;
    color=mix(
      color,
      vec3(1.0,.98,.88),
      clamp(settleSeaGlow*.34,0.0,.34)
    );

    gl_FragColor=vec4(color,1.0);
  }
`;

export const roughGlassFragmentShader = `
  precision highp float;
  uniform sampler2D uBump;
  uniform sampler2D uBackdrop;
  // EMBEDDED GLASS: uniform sampler2D uEmbeddedGlass;
  uniform sampler2D uDomRefraction;
  uniform samplerCube uEnvironment;
  uniform vec2 uTexel;
  uniform float uRefractionStrength;
  uniform float uGlassTransmission;
  uniform float uGlassBrightness;
  uniform float uGlassRoughness;
  uniform float uGlassReflection;
  uniform float uGlassEdgeLight;
  uniform float uProjectionStrength;
  uniform float uHammeredStrength;
  uniform float uWaveScale;
  uniform float uWaveRandomness;
  uniform float uWaveAmplitude;
  uniform float uWaveEdgeStrength;
  uniform float uWaveRefraction;
  uniform float uWaveShadow;
  uniform float uEnhancedSurface;
  uniform float uFloorY;
  uniform float uBandBottomY;
  uniform float uBandTopY;
  uniform vec3 uWallColor;
  uniform vec3 uFloorColor;
  uniform vec3 uLightDirection;
  uniform float uSettleLightPosition;
  uniform float uSettleLightStrength;
  uniform float uBackgroundReflectionStrength;
  uniform float uBackgroundReflectionRayDistance;
  uniform vec3 uBandColor;
  varying vec2 vUv;
  varying vec2 vScreenUv;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying vec3 vWorldTangent;
  varying vec3 vWorldBitangent;

  const float PI=3.14159265359;

  vec3 sceneAt(vec2 uv){
    uv=clamp(uv,vec2(.002),vec2(.998));
    vec4 backdrop=texture2D(uBackdrop,uv);
    // EMBEDDED GLASS: vec4 embeddedGlass=texture2D(uEmbeddedGlass,uv);
    // EMBEDDED GLASS: backdrop.rgb=mix(backdrop.rgb,embeddedGlass.rgb,embeddedGlass.a);
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

  float distributionGgx(float nDotH,float roughness){
    float alpha=roughness*roughness;
    float alphaSquared=alpha*alpha;
    float denominator=nDotH*nDotH*(alphaSquared-1.0)+1.0;
    return alphaSquared/max(PI*denominator*denominator,.0001);
  }

  float geometrySchlickGgx(float nDotDirection,float roughness){
    float r=roughness+1.0;
    float k=r*r*.125;
    return nDotDirection/max(nDotDirection*(1.0-k)+k,.0001);
  }

  vec2 roughGlassHash(vec2 point){
    vec3 seed=fract(
      vec3(point.xyx)*vec3(.1031,.103,.0973)
    );
    seed+=dot(seed,seed.yzx+33.33);
    return fract((seed.xx+seed.yz)*seed.zy);
  }

  float roughGlassValueNoise(vec2 point){
    vec2 cell=floor(point);
    vec2 localPosition=fract(point);
    vec2 blend=localPosition*localPosition*localPosition
      *(localPosition*(localPosition*6.0-15.0)+10.0);
    float bottomLeft=roughGlassHash(cell).x;
    float bottomRight=roughGlassHash(cell+vec2(1.0,0.0)).x;
    float topLeft=roughGlassHash(cell+vec2(0.0,1.0)).x;
    float topRight=roughGlassHash(cell+vec2(1.0,1.0)).x;
    return mix(
      mix(bottomLeft,bottomRight,blend.x),
      mix(topLeft,topRight,blend.x),
      blend.y
    );
  }

  float roughGlassFbm(vec2 point){
    float value=0.0;
    float amplitude=.56;
    mat2 rotation=mat2(.8,-.6,.6,.8);
    for(int octave=0;octave<4;octave++){
      value+=roughGlassValueNoise(point)*amplitude;
      point=rotation*point*1.82+vec2(3.7,6.2);
      amplitude*=.42;
    }
    return value;
  }

  float localLiquidWave(
    vec2 point,
    vec2 center,
    vec2 direction,
    float frequency,
    float radius,
    float phase
  ){
    vec2 delta=point-center;
    vec2 waveDirection=normalize(direction);
    vec2 waveNormal=vec2(-waveDirection.y,waveDirection.x);
    float envelope=exp(
      -dot(delta,delta)/max(radius*radius*1.8,.0001)
    );
    float randomFlowA=roughGlassFbm(
      point*vec2(4.7,5.3)+center*11.7+phase
    )-.5;
    float randomFlowB=roughGlassFbm(
      point.yx*vec2(8.1,6.4)+center.yx*7.9-phase
    )-.5;
    float localBend=(
      randomFlowA*4.2
      +randomFlowB*2.1
      +sin(dot(delta,waveNormal)*frequency*.19+phase)*.32
    )*uWaveRandomness;
    float wavePhase=
      dot(delta,waveDirection)*frequency
      +localBend
      +phase;
    float shapedWave=
      sin(wavePhase)
      +sin(wavePhase*2.0+localBend*.34)*.2
      +sin(wavePhase*3.0-phase*.27)*.055;
    return shapedWave*envelope;
  }

  float hammeredHeight(vec2 uv){
    vec2 surfacePoint=(
      (uv-vec2(.5))*uWaveScale+vec2(.5)
    )*vec2(1.0,1.46);
    vec2 surfaceWarp=vec2(
      roughGlassFbm(surfacePoint*3.1+vec2(1.7,5.3)),
      roughGlassFbm(surfacePoint*3.3+vec2(7.1,2.4))
    )-.5;
    vec2 warpedPoint=surfacePoint
      +surfaceWarp*.035*(.4+uWaveRandomness*.6);
    float waveHeight=0.0;
    waveHeight+=localLiquidWave(
      warpedPoint,
      vec2(.08,1.31),
      vec2(.91,-.42),
      31.0,
      .58,
      .7
    )*.92;
    waveHeight+=localLiquidWave(
      warpedPoint,
      vec2(.82,1.18),
      vec2(-.56,-.83),
      37.0,
      .52,
      2.1
    )*.78;
    waveHeight+=localLiquidWave(
      warpedPoint,
      vec2(.24,.87),
      vec2(.38,-.93),
      34.0,
      .47,
      4.3
    )*.86;
    waveHeight+=localLiquidWave(
      warpedPoint,
      vec2(.76,.72),
      vec2(-.95,.31),
      41.0,
      .5,
      1.4
    )*.7;
    waveHeight+=localLiquidWave(
      warpedPoint,
      vec2(.1,.38),
      vec2(.74,.67),
      36.0,
      .46,
      5.6
    )*.8;
    waveHeight+=localLiquidWave(
      warpedPoint,
      vec2(.88,.24),
      vec2(-.31,.95),
      39.0,
      .49,
      3.2
    )*.74;
    waveHeight+=localLiquidWave(
      warpedPoint,
      vec2(.48,.52),
      vec2(.87,.5),
      29.0,
      .62,
      6.1
    )*.58;
    float quietSurface=
      roughGlassFbm(warpedPoint*7.4+vec2(2.8,8.1))-.5;
    return .5+(
      waveHeight*.052
      +quietSurface*.038
    )*uWaveAmplitude;
  }

  vec3 legacySurface(){
    vec2 reliefStep=uTexel*3.0;
    float leftHeight=texture2D(
      uBump,
      vUv-vec2(reliefStep.x,0.0)
    ).r;
    float rightHeight=texture2D(
      uBump,
      vUv+vec2(reliefStep.x,0.0)
    ).r;
    float downHeight=texture2D(
      uBump,
      vUv-vec2(0.0,reliefStep.y)
    ).r;
    float upHeight=texture2D(
      uBump,
      vUv+vec2(0.0,reliefStep.y)
    ).r;
    float centerHeight=texture2D(uBump,vUv).r;
    vec2 slope=vec2(
      rightHeight-leftHeight,
      upHeight-downHeight
    )*5.8;
    vec3 surfaceNormal=normalize(vec3(-slope.x,-slope.y,1.0));
    vec3 overheadLight=normalize(vec3(normalize(uLightDirection.xy),.24));
    vec3 halfVector=normalize(overheadLight+vec3(0.0,0.0,1.0));
    float flatLight=overheadLight.z;
    float waveLight=dot(surfaceNormal,overheadLight);
    float waveLighting=clamp((waveLight-flatLight)*2.2,-1.0,1.0);
    float waveHighlight=smoothstep(.035,.48,waveLighting);
    float waveShadow=smoothstep(.025,.5,-waveLighting);
    float waveSpecular=pow(max(dot(surfaceNormal,halfVector),0.0),30.0);
    float neighborHeight=(
      leftHeight+rightHeight+downHeight+upHeight
    )*.25;
    float cavityShadow=smoothstep(
      .018,
      .13,
      neighborHeight-centerHeight
    );
    float crestLight=smoothstep(
      .025,
      .14,
      centerHeight-neighborHeight
    );

    vec2 refractionOffset=slope
      *vec2(.0075,.006)
      *uRefractionStrength;
    float bandBoundaryProximity=1.0-smoothstep(
      .018,
      .105,
      abs(vScreenUv.y-uBandBottomY)
    );
    float bandBoundaryWave=sin(vUv.x*6.2+.4)*.006
      +sin(vUv.x*13.0-.7)*.0022;
    refractionOffset.y+=bandBoundaryWave
      *bandBoundaryProximity
      *uRefractionStrength;
    float relief=centerHeight-.5;
    refractionOffset+=vec2(
      slope.y-slope.x*.35,
      -slope.x-slope.y*.25
    )*relief*.0018*uRefractionStrength;
    vec2 refractedUv=clamp(
      vScreenUv-refractionOffset,
      vec2(.002),
      vec2(.998)
    );
    vec2 chromaticDirection=(slope+vec2(.001))
      /max(length(slope+vec2(.001)),.0001);
    vec2 chromaticOffset=chromaticDirection
      *(.00028+length(slope)*.00016);
    vec3 refractedRed=sceneAt(refractedUv+chromaticOffset);
    vec3 refractedGreen=sceneAt(refractedUv);
    vec3 refractedBlue=sceneAt(refractedUv-chromaticOffset);
    vec3 refractedBackdrop=vec3(
      refractedRed.r,
      refractedGreen.g,
      refractedBlue.b
    );
    vec3 color=mix(
      refractedBackdrop,
      sceneAt(vScreenUv),
      .82
    );
    vec2 bottomFaceOffset=vec2(.006,-.018)
      *(1.0+abs(relief)*.45);
    vec3 bottomFace=sceneAt(
      refractedUv+bottomFaceOffset+refractionOffset*.22
    );
    bottomFace=mix(bottomFace,vec3(.84,.91,.93),.12);
    float bottomPlane=1.0-smoothstep(.025,.27,vUv.y);
    float bottomSeam=exp(-pow((vUv.y-.12)/.028,2.0));
    color=mix(color,bottomFace,.16+bottomPlane*.56);
    color*=1.0-bottomSeam*.09;
    color=mix(color,vec3(.985,.99,.99),abs(relief)*.04);
    float blueBackdrop=smoothstep(
      .06,
      .28,
      color.b-max(color.r,color.g)
    );
    float cavityStrength=mix(.19,.3,blueBackdrop);
    color*=1.0-waveShadow*.16-cavityShadow*cavityStrength;
    float upperFaceLight=smoothstep(-.08,.62,surfaceNormal.y)
      *mix(.045,.2,smoothstep(.2,1.0,vUv.y));
    float topEdgeLight=exp(-pow((vUv.y-.94)/.105,2.0))
      *exp(-pow((vUv.x-.42)/.58,2.0));
    float microSurfaceHighlight=waveHighlight*.1
      +waveSpecular*.24
      +crestLight*.065
      +upperFaceLight
      +topEdgeLight*.34;
    color=mix(
      color,
      vec3(1.0,.997,.975),
      clamp(microSurfaceHighlight,0.0,.46)
    );
    float distanceToUpperBackground=max(
      uBandTopY-vScreenUv.y,
      0.0
    );
    float upperBackgroundReach=uBackgroundReflectionRayDistance
      *(.9+max(surfaceNormal.y,0.0)*.18);
    float upperBackgroundBand=1.0-smoothstep(
      upperBackgroundReach*.62,
      upperBackgroundReach,
      distanceToUpperBackground
    );
    float roughUpperReflection=clamp(
      upperBackgroundBand
        *smoothstep(-.42,.28,surfaceNormal.y)
        *(.68+.32*smoothstep(.42,.96,vUv.y))
        *uBackgroundReflectionStrength,
      0.0,
      .56
    );
    vec3 roughReflectedBackdrop=sceneAt(
      clamp(
        vScreenUv+surfaceNormal.xy*.0015,
        vec2(.002),
        vec2(.998)
      )
    );
    roughReflectedBackdrop=mix(
      roughReflectedBackdrop,
      uBandColor,
      .32
    );
    return mix(
      color,
      roughReflectedBackdrop,
      roughUpperReflection
    );
  }

  void main(){
    if(uEnhancedSurface<.5){
      gl_FragColor=vec4(legacySurface(),1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      return;
    }

    float bevelWidth=.028;
    float leftBevel=1.0-smoothstep(0.0,bevelWidth,vUv.x);
    float rightBevel=1.0-smoothstep(0.0,bevelWidth,1.0-vUv.x);
    float bottomBevel=1.0-smoothstep(0.0,bevelWidth,vUv.y);
    float topBevel=1.0-smoothstep(0.0,bevelWidth,1.0-vUv.y);
    float edgeBand=max(
      max(leftBevel,rightBevel),
      max(topBevel,bottomBevel)
    );
    vec2 hammeredStep=vec2(.0045,.003);
    float hammeredCenter=hammeredHeight(vUv);
    float hammeredLeft=hammeredHeight(
      vUv-vec2(hammeredStep.x,0.0)
    );
    float hammeredRight=hammeredHeight(
      vUv+vec2(hammeredStep.x,0.0)
    );
    float hammeredDown=hammeredHeight(
      vUv-vec2(0.0,hammeredStep.y)
    );
    float hammeredUp=hammeredHeight(
      vUv+vec2(0.0,hammeredStep.y)
    );
    vec2 hammeredGradient=vec2(
      (hammeredRight-hammeredLeft)/(hammeredStep.x*2.0),
      (hammeredUp-hammeredDown)/(hammeredStep.y*2.0)
    );
    vec2 hammeredSlope=hammeredGradient
      *.068
      *uHammeredStrength;
    vec3 localNormal=normalize(vec3(
      (leftBevel-rightBevel)*.72-hammeredSlope.x,
      (topBevel-bottomBevel)*.72-hammeredSlope.y,
      1.0
    ));
    vec3 normal=normalize(
      vWorldTangent*localNormal.x
        +vWorldBitangent*localNormal.y
        +vWorldNormal*localNormal.z
    );
    vec3 viewDirection=normalize(cameraPosition-vWorldPosition);
    vec3 lightDirection=normalize(uLightDirection);
    vec3 halfDirection=normalize(lightDirection+viewDirection);
    float nDotL=max(dot(normal,lightDirection),0.0);
    float nDotV=max(dot(normal,viewDirection),.001);
    float nDotH=max(dot(normal,halfDirection),0.0);
    vec2 reliefLightDirection=normalize(vec2(
      dot(lightDirection,vWorldTangent),
      dot(lightDirection,vWorldBitangent)
    )+vec2(.0001));
    float reliefHeightNear=hammeredHeight(clamp(
      vUv+reliefLightDirection*.009,
      vec2(.0),
      vec2(1.0)
    ));
    float reliefHeightMiddle=hammeredHeight(clamp(
      vUv+reliefLightDirection*.019,
      vec2(.0),
      vec2(1.0)
    ));
    float reliefHeightFar=hammeredHeight(clamp(
      vUv+reliefLightDirection*.034,
      vec2(.0),
      vec2(1.0)
    ));
    float reliefSelfShadow=max(
      smoothstep(.008,.075,reliefHeightNear-hammeredCenter),
      max(
        smoothstep(.014,.095,reliefHeightMiddle-hammeredCenter),
        smoothstep(.022,.12,reliefHeightFar-hammeredCenter)
      )
    );

    vec2 hammeredRefraction=hammeredGradient
      *uHammeredStrength
      *uWaveRefraction
      *vec2(.00019,.00015);
    vec2 clearSampleUv=clamp(
      vScreenUv-hammeredRefraction,
      vec2(.002),
      vec2(.998)
    );
    vec3 clearTransmission=sceneAt(clearSampleUv);
    vec3 color=clearTransmission;
    color=mix(
      vec3(.975,.985,.99),
      color,
      clamp(uGlassTransmission,0.0,1.0)
    )*uGlassBrightness;
    float flatNdotL=max(
      dot(normalize(vWorldNormal),lightDirection),
      0.0
    );
    float reliefLight=clamp(nDotL-flatNdotL,-.32,.32);
    float hammeredCurvature=(
      hammeredLeft
      +hammeredRight
      +hammeredDown
      +hammeredUp
      -hammeredCenter*4.0
    );
    float hammeredValleyShadow=smoothstep(
      .002,
      .026,
      hammeredCurvature
    );
    float waveEdgeSlope=smoothstep(
      .48,
      1.75,
      length(hammeredGradient)
    );
    float waveEdgeCurvature=smoothstep(
      .003,
      .028,
      abs(hammeredCurvature)
    );
    float waveEdgeMask=waveEdgeSlope
      *mix(.42,1.0,waveEdgeCurvature);
    float hammeredDepthShadow=
      1.0-smoothstep(.16,.43,hammeredCenter);
    color*=1.0
      +reliefLight*.2
      -hammeredValleyShadow*.12*uWaveShadow
      -hammeredDepthShadow*.052*uWaveShadow
      -reliefSelfShadow*.15*uWaveShadow;
    color=mix(
      color,
      color*vec3(.84,.91,.97),
      reliefSelfShadow*.12*uWaveShadow
    );
    float bottomInnerShadow=exp(-vUv.y/.032);
    color*=1.0
      -rightBevel*.065
      -bottomBevel*.085
      -bottomInnerShadow*.105;

    float hammeredCrest=smoothstep(.58,.88,hammeredCenter);
    float hammeredValley=1.0-smoothstep(.18,.42,hammeredCenter);
    float clearRoughness=clamp(
      (
        .12-hammeredCrest*.04+hammeredValley*.025
      )*uGlassRoughness,
      .07,
      .34
    );
    float roughness=clearRoughness;
    float distribution=distributionGgx(nDotH,roughness);
    float geometry=geometrySchlickGgx(nDotV,roughness)
      *geometrySchlickGgx(nDotL,roughness);
    float viewHalf=max(dot(viewDirection,halfDirection),0.0);
    vec3 fresnel=vec3(.04)
      +(vec3(1.0)-vec3(.04))*pow(1.0-viewHalf,5.0);
    vec3 directSpecular=fresnel
      *distribution
      *geometry
      /max(4.0*nDotV*nDotL,.001);

    vec3 reflectionDirection=reflect(-viewDirection,normal);
    vec3 environmentReflection=textureCube(
      uEnvironment,
      reflectionDirection
    ).rgb;
    float edgeFresnel=.04+.96*pow(1.0-nDotV,5.0);
    color+=environmentReflection
      *(.06+edgeFresnel*.46+edgeBand*.16)
      *uGlassReflection;
    color+=directSpecular
      *nDotL
      *.9
      *uGlassReflection;

    vec3 panelHalfA=normalize(
      normalize(vec3(-.62,.76,.38))+viewDirection
    );
    vec3 panelHalfB=normalize(
      normalize(vec3(.38,.88,.28))+viewDirection
    );
    vec3 panelHalfC=normalize(
      normalize(vec3(-.08,.58,.8))+viewDirection
    );
    float panelHighlightA=pow(
      max(dot(normal,panelHalfA),0.0),
      30.0
    );
    float panelHighlightB=pow(
      max(dot(normal,panelHalfB),0.0),
      46.0
    );
    float panelHighlightC=pow(
      max(dot(normal,panelHalfC),0.0),
      22.0
    );
    float castGlassHighlight=(
      panelHighlightA*.38
      +panelHighlightB*.62
      +panelHighlightC*.2
    );
    color+=vec3(1.0,.99,.95)*castGlassHighlight;
    float waveEdgeLighting=max(
      pow(max(dot(normal,panelHalfA),0.0),12.0),
      pow(max(dot(normal,panelHalfB),0.0),16.0)
    );
    color+=vec3(1.0,.995,.97)
      *waveEdgeMask
      *waveEdgeLighting
      *.34
      *uWaveEdgeStrength
      *uGlassReflection;

    float topRim=topBevel
      *(.35+.65*smoothstep(.12,.88,vUv.x));
    float leftRim=leftBevel
      *(1.0-smoothstep(.72,1.0,vUv.y));
    vec3 highlightColor=vec3(1.0,.985,.93);
    color+=highlightColor*(
      topRim*.19
      +leftRim*.075
    )*uGlassEdgeLight;

    float settleBand=exp(
      -pow((vScreenUv.x-uSettleLightPosition)/.016,2.0)
    );
    color+=highlightColor
      *settleBand
      *topBevel
      *.54
      *uSettleLightStrength;

    gl_FragColor=vec4(max(color,vec3(0.0)),1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const roughGlassWaveShaderChunk = roughGlassFragmentShader.slice(
  roughGlassFragmentShader.indexOf('  vec2 roughGlassHash'),
  roughGlassFragmentShader.indexOf('  vec3 legacySurface'),
);

export const roughGlassCausticVertexShader = `
  varying vec2 vUv;

  void main(){
    vUv=uv;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
  }
`;

export const roughGlassCausticFragmentShader = `
  precision highp float;
  uniform float uHammeredStrength;
  uniform float uWaveScale;
  uniform float uWaveRandomness;
  uniform float uWaveAmplitude;
  uniform float uWaveEdgeStrength;
  uniform float uWaveShadow;
  uniform float uProjectionStrength;
  uniform vec3 uLightDirection;
  varying vec2 vUv;

${roughGlassWaveShaderChunk}

  void main(){
    vec2 reliefStep=vec2(.0045,.003);
    float centerHeight=hammeredHeight(vUv);
    float leftHeight=hammeredHeight(
      vUv-vec2(reliefStep.x,0.0)
    );
    float rightHeight=hammeredHeight(
      vUv+vec2(reliefStep.x,0.0)
    );
    float downHeight=hammeredHeight(
      vUv-vec2(0.0,reliefStep.y)
    );
    float upHeight=hammeredHeight(
      vUv+vec2(0.0,reliefStep.y)
    );
    vec2 gradient=vec2(
      (rightHeight-leftHeight)/(reliefStep.x*2.0),
      (upHeight-downHeight)/(reliefStep.y*2.0)
    );
    float curvature=(
      leftHeight
      +rightHeight
      +downHeight
      +upHeight
      -centerHeight*4.0
    );
    float edgeSlope=smoothstep(
      .42,
      1.6,
      length(gradient)*uHammeredStrength
    );
    float edgeCurvature=smoothstep(.0025,.026,abs(curvature));
    float edgeMask=edgeSlope*mix(.38,1.0,edgeCurvature);

    vec2 lightDirection=normalize(uLightDirection.xy+vec2(.0001));
    float slopeFacing=dot(
      normalize(-gradient+vec2(.0001)),
      lightDirection
    );
    float lightEdge=edgeMask
      *smoothstep(-.08,.72,slopeFacing)
      *uWaveEdgeStrength;
    float scatteredEdge=edgeMask
      *(.42+.58*smoothstep(-.72,.58,slopeFacing))
      *uWaveEdgeStrength;
    float focusedLight=max(lightEdge,scatteredEdge);
    float lightPool=smoothstep(.006,.034,abs(curvature))
      *(.38+.62*edgeSlope);

    float edgeFade=
      smoothstep(.015,.075,vUv.x)
      *smoothstep(.015,.075,vUv.y)
      *smoothstep(.015,.075,1.0-vUv.x)
      *smoothstep(.015,.075,1.0-vUv.y);
    float lightAlpha=clamp(
      (
        focusedLight*.14
        +lightPool*.07*uWaveEdgeStrength
      )*edgeFade*uProjectionStrength,
      0.0,
      .46
    );
    float colorVariation=roughGlassValueNoise(
      vUv*vec2(17.0,23.0)+vec2(4.2,8.6)
    );
    vec3 projectionColor=mix(
      vec3(.68,.9,1.0),
      vec3(1.0,.995,.91),
      smoothstep(.38,.78,colorVariation)
    );
    projectionColor=mix(
      projectionColor,
      vec3(1.0),
      lightPool*.38
    );

    gl_FragColor=vec4(projectionColor,lightAlpha);
    #include <colorspace_fragment>
  }
`;
