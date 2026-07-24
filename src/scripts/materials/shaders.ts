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
  uniform float uSettleLightPosition;
  uniform float uSettleLightStrength;
  uniform vec3 uBackgroundReflectionFallback;
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
    float reflectionLimit=mix(.18,.38,sideMask)+thinRim*.1;
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
      sideMask*totalInternalReflection*(.04+internalDarkAlignment*.52),
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
    float backgroundReflection=topFacing
      *reflectionBand
      *mix(.18,1.0,backgroundFacetAlignment)
      *uBackgroundReflectionStrength;

    vec3 transmitted=refracted*mix(1.0,.42,internalDark);
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
    color=mix(
      color,
      reflectedBackground,
      clamp(backgroundReflection,0.0,.72)
    );
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

  vec3 glassRay(vec3 incident,vec3 surfaceNormal,float ior){
    vec3 transmitted=refract(incident,surfaceNormal,1.0/ior);
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
    vec3 incident=normalize(vWorldPosition-cameraPosition);
    vec3 viewDirection=-incident;
    float profile=clamp(vSurfaceRegion,0.0,1.0);
    float lateralNormal=clamp(vBevelProgress,0.0,1.0);
    float frontFace=1.0-smoothstep(.015,.09,profile);
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
      frontFace*.16+innerShoulder*.58+outerShoulder*.86+sideMask,
      .12,
      1.0
    );
    float iorSpread=uDispersionStrength*.11;
    vec2 incidentSlope=raySlope(incident);
    vec2 redBend=(
      raySlope(glassRay(incident,worldNormal,uIor-iorSpread))-incidentSlope
    )*uRefraction*opticalPath*opticalRegion;
    vec2 greenBend=(
      raySlope(glassRay(incident,worldNormal,uIor))-incidentSlope
    )*uRefraction*opticalPath*opticalRegion;
    vec2 blueBend=(
      raySlope(glassRay(incident,worldNormal,uIor+iorSpread))-incidentSlope
    )*uRefraction*opticalPath*opticalRegion;
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
      fresnel*(.72+sideMask*.72+rearShoulder*.28)
        +lateralNormal*.025
        +keyBroad*.16
        +keySharp*.24,
      0.0,
      .86
    );
    vec3 color=mix(transmitted,environment,reflectionWeight);

    float innerRail=gaussian(profile,.18,.055)
      *innerShoulder*upperSide;
    float outerRail=gaussian(profile,.49,.085)
      *outerShoulder*(.45+upperSide*.55);
    float lightStrength=clamp(uGlintStrength*.34,0.0,1.2);
    color+=vec3(1.0,.995,.975)*(
      keyBroad*.26
        +keySharp*.46
        +innerRail*.14
        +outerRail*.11
    )*lightStrength;

    float spectralStrength=clamp(
      uDispersionStrength*opticalPath*(
        innerShoulder*.08
          +outerShoulder*.18
          +sideMask*.3
          +bottomSurface*.12
      )*(.45+grazing*.55),
      0.0,
      .12
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
      uBackgroundReflectionFallback,
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
  uniform float uSettleLightPosition;
  uniform float uSettleLightStrength;
  uniform vec3 uBackgroundReflectionFallback;
  uniform float uBandTopY;
  uniform float uBackgroundReflectionStrength;
  uniform float uBackgroundReflectionRayDistance;
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
    vec3 topPanelRay=reflect(-viewDirection,normal);
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
  uniform sampler2D uDomRefraction;
  uniform vec2 uTexel;
  uniform float uRefractionStrength;
  uniform float uFloorY;
  uniform float uBandBottomY;
  uniform vec3 uWallColor;
  uniform vec3 uFloorColor;
  uniform vec2 uLightDirection;
  uniform float uSettleLightPosition;
  uniform float uSettleLightStrength;
  uniform vec3 uBackgroundReflectionFallback;
  uniform float uBandTopY;
  uniform float uBackgroundReflectionStrength;
  uniform float uBackgroundReflectionRayDistance;
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
    vec3 overheadLight=normalize(vec3(uLightDirection,.24));
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
    float microSurfaceHighlight=waveHighlight*.028
      +waveSpecular*.075
      +crestLight*.016;
    color=mix(
      color,
      vec3(1.0,.998,.99),
      clamp(microSurfaceHighlight,0.0,.12)
    );
    float distanceToUpperBackground=max(uBandTopY-vScreenUv.y,0.0);
    float upperBackgroundReach=uBackgroundReflectionRayDistance
      *(.9+max(surfaceNormal.y,0.0)*.18);
    float upperBackgroundBand=1.0-smoothstep(
      upperBackgroundReach*.62,
      upperBackgroundReach,
      distanceToUpperBackground
    );
    float upwardFacet=smoothstep(-.42,.28,surfaceNormal.y);
    float upperFaceBias=.68+.32*smoothstep(.42,.96,vUv.y);
    float roughUpperReflection=clamp(
      upperBackgroundBand
        *upwardFacet
        *upperFaceBias
        *uBackgroundReflectionStrength,
      0.0,
      .56
    );
    color=mix(
      color,
      uBackgroundReflectionFallback,
      roughUpperReflection
    );
    gl_FragColor=vec4(color,1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
