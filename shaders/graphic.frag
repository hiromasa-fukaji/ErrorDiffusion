precision highp float;
varying vec2 vTexCoord;
varying vec4 vVertexColor;
uniform sampler2D depth;
uniform sampler2D color;
uniform float width;
uniform float height;

float remap(float value, float min, float max, float minOut, float maxOut) {
  return minOut + (value - min) * (maxOut - minOut) / (max - min);
}

// Simplex Noise implementation with type-matched input/output

vec2 mod289(vec2 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289(vec4 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x) {
  return mod289(((x*34.0)+1.0)*x);
}

vec4 taylorInvSqrt(vec4 r) {
  return 1.79284291400159 - 0.85373472095314 * r;
}

// 1D Simplex noise
float noise(float x) {
  float i0 = floor(x);
  float i1 = i0 + 1.0;
  float x0 = x - i0;
  float x1 = x0 - 1.0;

  float t0 = 1.0 - x0*x0;
  t0 *= t0;
  float n0 = t0 * t0 * sin(i0 * 0.01);

  float t1 = 1.0 - x1*x1;
  t1 *= t1;
  float n1 = t1 * t1 * sin(i1 * 0.01);

  return 2.3 * (n0 + n1);
}

// 2D Simplex noise
vec2 noise(vec2 v) {
  const vec4 C = vec4(0.211324865405187,  // (3.0-sqrt(3.0))/6.0
                      0.366025403784439,  // 0.5*(sqrt(3.0)-1.0)
                     -0.577350269189626,  // -1.0 + 2.0 * C.x
                      0.024390243902439); // 1.0 / 41.0

  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);

  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;

  i = mod289(i);
  vec4 p = permute( permute( i.y + vec4(0.0, i1.y, 1.0, 1.0 ))
        + i.x + vec4(0.0, i1.x, 1.0, 1.0 ));

  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;

  vec3 x = 2.0 * fract(p.xyz * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;

  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );

  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;

  float n1 = 130.0 * dot(m, g);
  float n2 = 130.0 * dot(m.yzx, g.yzx);
  return vec2(n1, n2);
}

// 3D Simplex noise
vec3 noise(vec3 v) {
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 =   v - i + dot(i, C.xxx) ;

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

  float n_ = 0.142857142857;
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  vec4 m2 = m * m;

  vec4 pdotn = vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3));
  vec3 result = 42.0 * vec3(
    dot(m2, pdotn),
    dot(m2.yzw, pdotn.yzw),
    dot(m2.zwy, pdotn.zwy)
  );

  return result;
}

// 4D Simplex noise (simplified implementation using 3D basis)
vec4 noise(vec4 v) {
  // Use 3D noise with different offsets for each component
  vec3 n1 = noise(v.xyz);
  vec3 n2 = noise(v.yzw + vec3(31.73, 17.29, 43.67));
  vec3 n3 = noise(v.zwx + vec3(67.23, 89.45, 12.34));
  vec3 n4 = noise(v.wxy + vec3(56.78, 34.56, 78.90));

  return vec4(
    (n1.x + n2.y + n3.z) * 0.333,
    (n1.y + n2.z + n4.x) * 0.333,
    (n1.z + n3.x + n4.y) * 0.333,
    (n2.x + n3.y + n4.z) * 0.333
  );
}

// Cross-type noise functions: different input and output types

// vec2 input to float output
float noise_f(vec2 v) {
  vec2 n = noise(v);
  return (n.x + n.y) * 0.5;
}

// vec3 input to float output
float noise_f(vec3 v) {
  vec3 n = noise(v);
  return (n.x + n.y + n.z) * 0.333;
}

// vec4 input to float output
float noise_f(vec4 v) {
  vec4 n = noise(v);
  return (n.x + n.y + n.z + n.w) * 0.25;
}

// float input to vec2 output
vec2 noise_v2(float x) {
  float n1 = noise(x);
  float n2 = noise(x + 127.531);
  return vec2(n1, n2);
}

// vec3 input to vec2 output
vec2 noise_v2(vec3 v) {
  vec3 n = noise(v);
  return vec2(n.x, n.y);
}

// vec4 input to vec2 output
vec2 noise_v2(vec4 v) {
  vec4 n = noise(v);
  return vec2(n.x, n.y);
}

// float input to vec3 output
vec3 noise_v3(float x) {
  float n1 = noise(x);
  float n2 = noise(x + 127.531);
  float n3 = noise(x + 249.123);
  return vec3(n1, n2, n3);
}

// vec2 input to vec3 output
vec3 noise_v3(vec2 v) {
  vec2 n2d = noise(v);
  float n3 = noise(v.x + v.y * 73.29);
  return vec3(n2d, n3);
}

// vec4 input to vec3 output
vec3 noise_v3(vec4 v) {
  vec4 n = noise(v);
  return vec3(n.x, n.y, n.z);
}

// float input to vec4 output
vec4 noise_v4(float x) {
  float n1 = noise(x);
  float n2 = noise(x + 127.531);
  float n3 = noise(x + 249.123);
  float n4 = noise(x + 371.789);
  return vec4(n1, n2, n3, n4);
}

// vec2 input to vec4 output
vec4 noise_v4(vec2 v) {
  vec2 n2d = noise(v);
  float n3 = noise(v.x + v.y * 73.29);
  float n4 = noise(v.y + v.x * 91.47);
  return vec4(n2d, n3, n4);
}

// vec3 input to vec4 output
vec4 noise_v4(vec3 v) {
  vec3 n3d = noise(v);
  float n4 = noise(v.x + v.y * 73.29 + v.z * 157.83);
  return vec4(n3d, n4);
}

void main() {
  // Get the pixel's depth value.
  float depthVal = texture2D(depth, vTexCoord).r;
  // depthVal = remap(depthVal, 0.5, 1.0, 0.0, 1.0);

  // Calculate texel size (approximate, assuming 512x512 texture)
  vec2 texelSize = vec2(1.0 / width, 1.0 / height);

  // Sample neighboring pixels
  float depthRight = texture2D(depth, vTexCoord + vec2(texelSize.x, 0.0)).r;
  float depthLeft = texture2D(depth, vTexCoord - vec2(texelSize.x, 0.0)).r;
  float depthUp = texture2D(depth, vTexCoord + vec2(0.0, texelSize.y)).r;
  float depthDown = texture2D(depth, vTexCoord - vec2(0.0, texelSize.y)).r;

  // Calculate depth gradient using central differences
  vec2 depthGradient = vec2(
    (depthRight - depthLeft) / (2.0 * texelSize.x),
    (depthUp - depthDown)  / (2.0 * texelSize.y)
  );

  depthGradient = normalize(depthGradient);

  vec2 perpDepthGradient = depthGradient;//normalize(vec2(depthGradient.y, -depthGradient.x));
  float dotval = dot(vTexCoord * vec2(width, height), perpDepthGradient);
  // dotval = abs(dotval);
  dotval = mod(dotval, 10.0) / 10.0;

  // Set the pixel's color based on its depth.
  vec4 depthcol = mix(
    vec4(1., 1., 1., 1.),
    vec4(0., 0., 0., 1.),
    depthVal);
  vec4 col = texture2D(color, vTexCoord);
  // col.rgb *= depthVal;
  
  vec4 val = vec4(0.0, 0.0, 0.0, 1.0);
  for(int i=0; i<3; i++){
    //float noiseval = noise_f(vTexCoord * (10.0));// + float(i) * 1.0));

    float newdepth = depthVal;// + (noiseval - 0.5) * 0.0005;//(0.0005 + 0.0005 * float(i));
    float step = 0.01;// + 0.005 * float(i);
    val[i] = mod(newdepth, step) / step ;// < 0.5 ? 0. : 1.;
  }
  
  gl_FragColor = col * depthcol;//val;///mix(col, vec4(1.0, 1.0, 1.0, 1.0), val);
  // gl_FragColor = vec4(depthGradient, 0.0, 1.0);

  // gl_FragColor = depthcol;//vec4(dotval, dotval, dotval, 1.0);
}

