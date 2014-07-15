
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
		for (var i = 0; i < l/2; i++) {
			pts.push(i - l/2);
			pts.push(data[i + l/2]);
			pts.push(z);
		}
		for ( ; i < l; i++) {
			pts.push(i - l/2);
			pts.push(data[i - l/2]);
			pts.push(z);
		}
		//z += zstep;
		array = new Float32Array(pts);

		var geometry = new THREE.BufferGeometry();
		geometry.attributes = {
			position: {
				itemSize: 3,
				array: array, 
				numItems: array.length
			},
			color: {
				itemSize: 3,
				array: new Float32Array(array.length),
				numItems: array.length
			}
		}
		geometry.computeBoundingSphere();

		var positions = geometry.attributes.position.array;
		var colors = geometry.attributes.color.array;

		//var color = new THREE.Color();
		for ( var i = 0; i < positions.length; i += 3 ) {
			var color = lut.getColor(positions[i+1]);
			//color.setRGB(1,1,1);
			colors[ i ]     = color.r;
			colors[ i + 1 ] = color.g;
			colors[ i + 2 ] = color.b;
		}

		var material = new THREE.ParticleBasicMaterial( { size: 5, vertexColors: true } );
		return new THREE.ParticleSystem( geometry, material );
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
			for (i = 0; i < scene.children.length - 200; i++) {
				scene.remove(scene.children[i]);
			}
			for (; i < scene.children.length; i++) {
				scene.children[i].translateZ(-10);
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

    startButton.addEventListener('click', start);
    stopButton.addEventListener('click', stop);
    frequencyField.addEventListener('focus', updateFrequency);
    frequencyField.addEventListener('change', changeFrequency);
}

window.addEventListener("load", initialize, false);
