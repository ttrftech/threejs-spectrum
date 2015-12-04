
if ( ! Detector.webgl ) Detector.addGetWebGLMessage();

function initialize() {
	var container, stats;
	var camera, scene, renderer, controls;
	var mesh;
	var particleSystem;

	var audioElement = document.getElementById("audio");
	var container = document.getElementById('container');
	var radio = new RadioController();

	var lut = new THREE.Lut( "picm", 512 );
	//var lut = new THREE.Lut( "blackbody", 512 );
	//var lut = new THREE.Lut( "cooltowarm", 512 );
	//var lut = new THREE.Lut( "rainbow", 512 );
	lut.setMax(100);

	function render() {
		//var time = Date.now() * 0.001;
		//particleSystem.rotation.x = time * 0.25;
		//particleSystem.rotation.y = time * 0.5;
		renderer.render( scene, camera );
		stats.update();
	}

	function onWindowResize() {
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();
		renderer.setSize( window.innerWidth, window.innerHeight );
		controls.handleResize();
		render();
	}

	function createParticleSystem(data) {
		var z = 500.0;
		var pts = [];
		var l = data.length;
		if (l > 4096)
			l = 4096;



		var positions = new THREE.Float32Attribute(l, 3);
		var colors = new THREE.Float32Attribute(l, 3);
		for (var i = 0; i < l/2; i++) {
			var x = i - l/2;
			var y = data[i + l/2];
			positions.setXYZ(i, x, y, z);
			var color = lut.getColor(y);
			colors.setXYZ(i, color.r, color.g, color.b);
		}
		for ( ; i < l; i++) {
			var x = i - l/2;
			var y = data[i - l/2];
			positions.setXYZ(i, x, y, z);
			var color = lut.getColor(y);
			colors.setXYZ(i, color.r, color.g, color.b);
		}
		var geometry = new THREE.BufferGeometry();
		var material = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.7 });
		geometry.addAttribute('position', positions);
		geometry.addAttribute('color', colors);
		geometry.computeBoundingSphere();
		return new THREE.Line(geometry, material);
	}

	function fft(samples) {
        var data = new complex_array.ComplexArray(4096);
		data.map(function(value, i, n) {
			value.real = samples[i * 2 + 1] - 128;
			value.imag = samples[i * 2] - 128;
			//console.log(samples[i * 2]);
		});
		data.FFT();
		return data.magnitude();
	}

	camera = new THREE.PerspectiveCamera( 27, window.innerWidth / window.innerHeight, 5, 100000 );
	camera.position.z = 2000;
	camera.position.y = 500;

	controls = new THREE.TrackballControls( camera );
	controls.staticMoving = true;
	controls.dynamicDampingFactor = 0.3;
	controls.keys = [ 65, 83, 68 ];
	controls.addEventListener( 'change', render );

	renderer = new THREE.WebGLRenderer( { antialias: false, clearColor: 0x333333, clearAlpha: 1, alpha: false } );
	renderer.setSize( window.innerWidth, window.innerHeight );

	container.appendChild( renderer.domElement );

	stats = new Stats();
	stats.domElement.style.position = 'absolute';
	stats.domElement.style.top = '0px';
	container.appendChild( stats.domElement );

	window.addEventListener( 'resize', onWindowResize, false );

	var animation = function() {
		samples = radio.getSamples();
		if (radio.isPlaying() && samples) {
			//console.log(samples.length);
			var i;
			for (i = 0; i < scene.children.length - 400; i++) {
				scene.remove(scene.children[i]);
			}
			for (; i < scene.children.length; i++) {
				scene.children[i].translateZ(-5);
			}

			data = fft(new Uint8Array(samples));
			//console.log(data);
			particleSystem = createParticleSystem(data);
			scene.add( particleSystem );
		}
		render();
		controls.update();

		requestAnimationFrame(animation);
	};

	scene = new THREE.Scene();
	//scene.fog = new THREE.Fog( 0x000000, 3000, 5000);
	scene.translateZ(-500);

	function start() {
		radio.start(function() {
			animation();
		});
	}
	function stop() {
		radio.stop();
	}
	function changeFrequency() {
		radio.setFrequency(parseFloat(frequencyField.value) * 1e6);
	}
	function updateFrequency() {
		frequencyField.value = radio.getFrequency() / 1e6;
	}
	function changeFreqButton(button) {
		frequencyField.value = button.value;
		changeFrequency();
	}

    startButton.addEventListener('click', start);
    stopButton.addEventListener('click', stop);
    frequencyField.addEventListener('focus', updateFrequency);
    frequencyField.addEventListener('change', changeFrequency);

    freq1.addEventListener('click', function() { changeFreqButton(freq1) });
    freq2.addEventListener('click', function() { changeFreqButton(freq2) });
    freq3.addEventListener('click', function() { changeFreqButton(freq3) });
    freq4.addEventListener('click', function() { changeFreqButton(freq4) });
    freq5.addEventListener('click', function() { changeFreqButton(freq5) });
    freq6.addEventListener('click', function() { changeFreqButton(freq6) });
    freq7.addEventListener('click', function() { changeFreqButton(freq7) });

	updateFrequency();
}

window.addEventListener("load", initialize, false);
