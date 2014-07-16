navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
window.URL = window.URL || window.webkitURL || window.mozURL || window.msURL;
window.AudioContext = window.AudioContext || window.webkitAudioContext || window.mozAudioContext || window.msAudioContext;

if ( ! Detector.webgl ) Detector.addGetWebGLMessage();

function initialize() {
	var container, stats;
	var camera, scene, renderer, controls;
	var mesh;
	var particleSystem;

	var audioElement = document.getElementById("audio");
	var container = document.getElementById('container');

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

	function createParticleSystem(frequencyData) {
		var z = 500.0;
		var l = frequencyData.length;

		var positions = new THREE.Float32Attribute(l, 3);
		var colors = new THREE.Float32Attribute(l, 3);
		for (var i = 0; i < l; i++) {
			var x = i - l/2;
			var y = frequencyData[i];
			positions.setXYZ(i, x, y, z);
			var color = lut.getColor(y);
			colors.setXYZ(i, color.r, color.g, color.b);
		}
		var geometry = new THREE.BufferGeometry();
		var material = new THREE.LineBasicMaterial({ vertexColors: true });
		geometry.addAttribute('position', positions);
		geometry.addAttribute('color', colors);
		geometry.computeBoundingSphere();
		return new THREE.Line(geometry, material);
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

	navigator.getUserMedia(
		{audio : true},
		function(stream) {
			var url = URL.createObjectURL(stream);
			audioElement.src = url;
			var audioContext = new AudioContext();
			var mediastreamsource = audioContext.createMediaStreamSource(stream);
			var analyser = audioContext.createAnalyser();
			var frequencyData = new Uint8Array(analyser.frequencyBinCount);
			//var timeDomainData = new Uint8Array(analyser.frequencyBinCount);
			mediastreamsource.connect(analyser);

			var animation = function(){
				analyser.getByteFrequencyData(frequencyData);
				//analyser.getByteTimeDomainData(timeDomainData);
                //frequencyContext.clearRect(0, 0, width, height);
				//frequencyContext.beginPath();
				//frequencyContext.moveTo(0, height - frequencyData[0]);
				//for (var i = 1, l = frequencyData.length; i < l; i++) {
				//	frequencyContext.lineTo(i, height - frequencyData[i]);
				//}
				//frequencyContext.stroke();

				//scene = new THREE.Scene();
				var i;
				for (i = 0; i < scene.children.length - 100; i++) {
					scene.remove(scene.children[i]);
				}
				for (; i < scene.children.length; i++) {
					scene.children[i].translateZ(-10);
				}				
				particleSystem = createParticleSystem(frequencyData);
				scene.add( particleSystem );
				render();
				controls.update();

				requestAnimationFrame(animation);
			};

			scene = new THREE.Scene();
			//scene.fog = new THREE.Fog( 0x000000, 3000, 5000);
			scene.translateZ(-500);
			animation();
		},
		function(e) {
			console.log(e);
		}
	);
}

window.addEventListener("load", initialize, false);
