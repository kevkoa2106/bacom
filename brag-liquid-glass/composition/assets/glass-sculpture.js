/* Procedural optical sculpture. Absolute-time rendering; no media or runtime loops. */
(function () {
  'use strict';

  const vertexSource = `#version 300 es
    in vec2 aPosition;
    void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
  `;

  const fragmentSource = `#version 300 es
    precision highp float;
    out vec4 outColor;
    uniform vec2 uCenter;
    uniform float uRadius;
    uniform float uTime;
    uniform float uPresence;

    mat2 turn(float a) {
      float c = cos(a), s = sin(a);
      return mat2(c, -s, s, c);
    }

    // Two elliptical-section ribbons turn through each other in object space.
    // Their changing cross-section creates broad optical faces and knife-like rims.
    float ribbon(vec3 p, float phase, float radius, vec2 thickness) {
      float angle = atan(p.z, p.x);
      float ring = radius + 0.065 * sin(angle * 3.0 + phase);
      vec2 q = vec2(length(p.xz) - ring,
        p.y - 0.13 * sin(angle * 2.0 + phase));
      q = turn(angle * 2.0 + phase + uTime * 0.16) * q;
      float k0 = length(q / thickness);
      float k1 = max(length(q / (thickness * thickness)), 0.0001);
      return k0 * (k0 - 1.0) / k1;
    }

    float field(vec3 p) {
      p.xy = turn(-0.28 + uTime * 0.18) * p.xy;
      p.yz = turn(0.83 + 0.22 * sin(uTime * 0.37)) * p.yz;
      p.xz = turn(uTime * 0.14) * p.xz;
      float a = ribbon(p, 0.4, 1.02, vec2(0.245, 0.092));
      vec3 q = p;
      q.xy = turn(0.88) * q.xy;
      q.yz = turn(0.72) * q.yz;
      q.x += 0.09;
      float b = ribbon(q, 2.5, 0.91, vec2(0.17, 0.074));
      return min(a, b) * 0.60;
    }

    vec3 normalAt(vec3 p) {
      vec2 e = vec2(0.0012, 0.0);
      return normalize(vec3(
        field(p + e.xyy) - field(p - e.xyy),
        field(p + e.yxy) - field(p - e.yxy),
        field(p + e.yyx) - field(p - e.yyx)
      ));
    }

    // Analytic studio environment: no textures, image models, or sampled HDRIs.
    vec3 studio(vec3 d) {
      vec3 color = vec3(0.13, 0.16, 0.20);
      float topBox = pow(max(dot(d, normalize(vec3(-0.55, 0.8, 0.4))), 0.0), 32.0);
      float longBox = exp(-pow((d.x + 0.42) * 21.0, 2.0))
        * smoothstep(-0.5, 0.2, d.y) * (1.0 - smoothstep(0.2, 0.8, d.y));
      float rightBox = pow(max(dot(d, normalize(vec3(0.9, 0.2, 0.1))), 0.0), 80.0);
      float ceiling = pow(max(d.y, 0.0), 4.0);
      float ice = pow(max(dot(d, normalize(vec3(-0.8, -0.1, -0.4))), 0.0), 9.0);
      color += vec3(1.0, 0.98, 0.95) * (topBox * 3.2 + longBox * 1.6);
      color += vec3(0.83, 0.91, 1.0) * (rightBox * 3.4 + ceiling * 1.2);
      color += vec3(0.31, 0.56, 0.67) * ice * 0.42;
      return color;
    }

    void main() {
      vec2 q = (gl_FragCoord.xy - uCenter) / uRadius;
      // Reject empty pixels before the expensive field evaluation at UHD resolution.
      if (dot(q, q) > 1.32 || uPresence < 0.001) {
        outColor = vec4(0.0); return;
      }
      vec3 ro = vec3(0.0, 0.0, 6.0);
      vec3 rd = normalize(vec3(q * 1.76, -6.0));
      float b = dot(ro, rd);
      float sphereD = b * b - dot(ro, ro) + 2.02;
      if (sphereD < 0.0) { outColor = vec4(0.0); return; }
      float travel = max(-b - sqrt(sphereD), 0.0);
      float end = -b + sqrt(sphereD);
      float dist = 1.0;
      vec3 p = ro;
      bool hit = false;
      for (int i = 0; i < 100; i++) {
        p = ro + rd * travel;
        dist = field(p);
        if (dist < 0.0009) { hit = true; break; }
        travel += max(dist, 0.001);
        if (travel > end) break;
      }
      if (!hit) { outColor = vec4(0.0); return; }

      vec3 n = normalAt(p);
      float facing = clamp(dot(-rd, n), 0.0, 1.0);
      float fresnel = 0.045 + 0.955 * pow(1.0 - facing, 5.0);
      vec3 reflected = studio(reflect(rd, n));
      vec3 transmitted = refract(rd, n, 1.0 / 1.47);
      vec3 through = studio(normalize(transmitted + n * 0.075));
      // Thin-film phase changes with both viewing angle and physical surface position.
      float filmPhase = (1.0 - facing) * 8.0 + p.y * 1.5 + p.x * 0.6;
      vec3 film = 0.68 + 0.32 * cos(filmPhase + vec3(0.0, 2.05, 4.1));
      float rim = pow(1.0 - facing, 2.3);
      float light = max(reflected.r, max(reflected.g, reflected.b));
      vec3 color = reflected * (0.50 + fresnel * 0.80);
      color += through * 0.12;
      color += mix(vec3(0.77, 0.9, 1.0), film, 0.30) * rim * 0.65;
      // Narrow internal caustic contours follow the twist rather than screen coordinates.
      float caustic = pow(max(sin(p.x * 11.0 + p.y * 14.0 + p.z * 6.0), 0.0), 24.0);
      color += vec3(0.60, 0.79, 0.87) * caustic * (0.035 + rim * 0.12);
      float alpha = clamp(0.10 + fresnel * 0.70 + light * 0.34 + rim * 0.18, 0.0, 0.96);
      // Straight alpha: the compositor supplies the actual moving product beneath.
      color = color / (vec3(0.76) + color);
      color = pow(color, vec3(1.0 / 2.2));
      outColor = vec4(color, alpha * uPresence);
    }
  `;

  function createGlassSculpture(canvas) {
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new TypeError('createGlassSculpture expects a canvas element.');
    }
    const gl = canvas.getContext('webgl2', {
      alpha: true, antialias: true, premultipliedAlpha: false,
      preserveDrawingBuffer: true, powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('The liquid glass sculpture requires WebGL2.');

    function compile(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error('Glass sculpture shader failed: ' + message);
      }
      return shader;
    }
    const vertex = compile(gl.VERTEX_SHADER, vertexSource);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('Glass sculpture link failed: ' + gl.getProgramInfoLog(program));
    }
    const buffer = gl.createBuffer();
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const uniforms = Object.fromEntries(
      ['uCenter', 'uRadius', 'uTime', 'uPresence']
        .map(name => [name, gl.getUniformLocation(program, name)]),
    );
    let disposed = false;
    const clamp = value => Math.max(0, Math.min(1, value));
    const smooth = value => { const p = clamp(value); return p * p * (3 - 2 * p); };
    const beats = [2.15, 6.6, 11.1, 13.05, 15.2];

    function render(absoluteTime) {
      if (disposed) return;
      const t = Math.max(0, Number(absoluteTime) || 0);
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round((rect.width || 1920) * dpr));
      const height = Math.max(1, Math.round((rect.height || 1080) * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      // Read holds occupy the negative space above the footer, to the right of
      // its text. The settings chapter contracts and shifts away from its labels.
      let x = 525 + Math.sin(t * 0.52) * 12;
      let y = 900 + Math.cos(t * 0.40) * 9;
      let radius = 205;
      const intro = 1 - smooth(t / 0.95);
      const closing = smooth((t - 16.3) / 1.3);
      const settingsHold = smooth((t - 11.35) / 0.3)
        * (1 - smooth((t - 14.65) / 0.3));
      x += intro * 100 + closing * 40 + settingsHold * 125;
      y += settingsHold * 20 - intro * 100;
      radius += intro * 90 + closing * 20 - settingsHold * 60;
      let presence = 0.82;
      for (let i = 0; i < beats.length; i++) {
        const phase = (t - beats[i] + 0.23) / 0.72;
        if (phase >= 0 && phase <= 1) {
          const wave = Math.sin(phase * Math.PI);
          const envelope = wave * wave;
          const progress = smooth(phase);
          x = x * (1 - envelope) + (-540 + progress * 3150) * envelope;
          y = y * (1 - envelope) + (720 - envelope * 100) * envelope;
          radius += envelope * 320;
          presence = Math.min(1, presence + envelope * 0.18);
        }
      }
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.disable(gl.BLEND);
      gl.uniform2f(uniforms.uCenter, x / 1920 * width, (1 - y / 1080) * height);
      gl.uniform1f(uniforms.uRadius, radius / 1920 * width);
      gl.uniform1f(uniforms.uTime, t);
      gl.uniform1f(uniforms.uPresence, presence);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function dispose() {
      if (disposed) return;
      disposed = true;
      gl.deleteVertexArray(vao);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    return { render, dispose };
  }

  window.createGlassSculpture = createGlassSculpture;
})();
