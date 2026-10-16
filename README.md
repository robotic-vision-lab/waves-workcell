# WAVES workcell

A minimal interactive workcell with the full lab, two fixed cameras, a wrist camera, and a pickup → fixture reorientation → regrasp → carry → insertion → release loop.

## Run locally

With Python 3 installed, run from this directory:

    python3 -m http.server 8791 --bind 127.0.0.1 --directory dist

Open http://127.0.0.1:8791/ in a modern browser. Opening index.html directly as a file does not work. All runtime dependencies are bundled locally; no login, API key, CDN, npm installation, or build service is needed.

## Physics

MuJoCo 3.16.0 runs in the browser through its official single-threaded WebAssembly build. All robot joints and the peg are dynamic. Position motors are force-limited; gripper mimic joints are constrained. The final regrasp uses a 4 Nm actuator limit (the initial pickup retains 0.6 Nm). Seating requires actual support contact, insertion depth, alignment, and upright orientation. The arm then holds position, opens the fingers, and withdraws. Missing seating confirmation holds the arm and keeps the hand closed instead of releasing on a timer. The peg is a free rigid body with gravity, friction, and contacts; it is never welded, parented, or teleported to the gripper. Only the complete episode reset restores initial state. The board collision shape preserves its holes through CAD-derived convex prisms.

The controller follows scripted motor targets, not a learned policy. Robot inertias and the U-shaped fixture collision proxies are approximate. This is a presentation physics model, not a calibrated digital twin or evidence of real-robot readiness. Small compliant-contact penetration is expected; the current WASM check measured less than 0.7 mm in the nominal sequence. No research training code, GPU run, or physical robot is controlled by this site.

## Source and validation

- dist/app.js: Three.js scene, camera interaction, and playback controls.
- dist/assets/physics.js: MuJoCo stepping, reset, and simulation seeking.
- source/model.xml: editable physics model and collision meshes.
- source/control.json: motor targets and initial joint state.
- source/build_assets.py: rebuild model.xml.gz and control.bin after editing their sources.
- source/validate.mjs: functional physics checks using the same WASM engine as the browser. Run with a modern Node.js: node source/validate.mjs.
- source/validation.json: latest check receipt. Two complete cycles must lift/regrasp the peg, limit held-peg displacement to 2 mm, stop downward travel within 0.5 mm after seating, and leave the peg seated after release and withdrawal. Separate tests check gravity after early opening and refusal to release without seating confirmation. The latest runs measured 1.48 mm maximum held-peg displacement (including compliant contact motion) and 0.047 mm downward travel after seating.
- dist/assets/*.bin: gzip-compressed JSON scene assets; decode with Python gzip/json to edit geometry.
- licenses/: upstream MuJoCo (Apache 2.0) and Three.js (MIT) license texts.

The timeline simulates forward from initial state when seeking backwards; it does not play a recorded peg pose. Physics is deterministic per runtime build, but CPU/native and browser/WASM arithmetic can differ. The checks assess physical outcomes independently, not bitwise equivalence.

## Hosting

Deploy dist as a static site. Serve .wasm as application/wasm. No special cross-origin isolation headers are required. This package is local and has not been published. The dist directory is ready for static hosting, including a Git-based deployment workflow.

## Rendering

The bamboo mesh is the only tabletop top surface; the supporting box has sides and a bottom only. This prevents competing depth surfaces from producing color patches while orbiting. Lighting and reflections still vary naturally with viewing angle.
