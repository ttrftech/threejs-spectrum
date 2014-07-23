Spectrum Display using three.js
===============================

This project contains real time 3D Spectrum display demo using three.js.

Two options of signal source, audio and radio.
 
## Audio Spectrum Display

### Requirement

- Browser supporting WebGL (tested with Chrome)

### Run

    $ git clone https://github.com/edy555/threejs-spectrum.git
    $ open threejs-spectrum/audio.html

Or just open following [URL](http://edy555.github.io/threejs-spectrum/audio.html).

===

## Radio Spectrum Display

### Requirement

- RTL2832U USB Dongle
- Chrome Web Browser

### Setup

    $ git clone https://github.com/edy555/threejs-spectrum.git
    $ cd threejs-spectrum
    $ git submodules update --init

### Run

On Chrome Web Browser,

1. Open Window>Extensions menu,
2. Check developer mode,
3. Click "Load unpacked extension..." button,
4. Select threejs-spectrum folder on file dialog,
5. Click "Launch" link in Radio Spectrum extension item.
6. Extension window will appear, then click Start button. 
7. To change frequency, hit Tab key twice to move focus and enter frequency in MHz.

===

## Acknowledgment

   - three.js [http://threejs.org/](https://github.com/mrdoob/three.js/)
   - jsfft [https://github.com/dntj/jsfft](https://github.com/dntj/jsfft)
