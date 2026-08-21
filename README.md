# Pocket-Jirai-pet

Lightweight raster-rig desk pet runtime targeting **PC + ESP32-S3**.

## Current prototype

- Browser preview using Canvas 2D
- 16 emotion states
- Automatic blink
- Breathing / idle sway
- MouthOpenY and lip-sync test
- 15 / 30 / 60 FPS preview modes
- Source-preserving raster workflow instead of PNG-to-SVG tracing
- Large pose changes use reference PNGs; repeated facial animation uses small cutout parts

## Target

- ESP32-S3 LCD: 15–30 FPS
- Total character assets: <= 3 MB
- Shared animation-state model between PC and embedded runtime
- Future low-poly mesh deformation for head, hair and torso

## Run

Open `index.html` through a static web server or GitHub Pages.

## Asset migration note

The initial web commit intentionally loads the already-validated raster assets from the previous `jirai-live2d` repository so the new project is immediately runnable without re-encoding or degrading the source PNGs. The next asset-pack step will move the finalized atlas/JPAK into this repository as the embedded runtime is implemented.
