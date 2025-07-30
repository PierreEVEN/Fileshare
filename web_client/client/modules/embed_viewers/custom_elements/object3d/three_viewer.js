// Import Threejs.
const THREE = require('three');
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls'
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {Sky} from 'three/addons/objects/Sky.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';

class ThreeRenderer {
    /**
     * @param container {HTMLElement}
     * @param blob {Blob}
     */
    constructor(container, blob) {

        this.container = container;
        this.blob = blob;
        this.container.addEventListener('resize', (event) => {
            this.onWindowResize(event)
        })

        new ResizeObserver(() => {
            this.onWindowResize()
        }).observe(container)


        // Scene.
        this.camera = null;
        this.scene = null;
        this.renderer = null;
        this.light;
        this.orbitControls = null;

        this.init();
        this.render();
    }

    init() {
        /**
         * @type {THREE.WebGLRenderer}
         */
        this.renderer = new THREE.WebGLRenderer({reverseDepthBuffer: true});
        this.renderer.setClearColor(0x000000);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(this.container.offsetWidth, this.container.offsetHeight);
        this.container.appendChild(this.renderer.domElement);
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.physicallyCorrectLights = true;

        // Scene.
        this.scene = new THREE.Scene();

        const loader = new GLTFLoader();
        const blob_url = URL.createObjectURL(this.blob);
        loader.load(blob_url, (gltf) => {

            this.scene.add(gltf.scene);

            const bounds = new THREE.Box3().setFromObject(gltf.scene);
            const boxSize = bounds.getSize(new THREE.Vector3());
            const boxCenter = bounds.getCenter(new THREE.Vector3());

            /**
             * Camera
             */

            // Camera.
            const fov = 45;
            const aspect = this.container.offsetWidth / this.container.offsetHeight;
            const near = boxSize.length() * 0.0001;
            const far = boxSize.length() * 10;
            this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);

            // Orbit controls.
            this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
            this.orbitControls.enablePan = true;
            this.orbitControls.enableKeys = true;
            this.orbitControls.update();
            this.orbitControls.addEventListener('change', () => {
                this.render()
            });
            this.camera.controls = this.orbitControls;



            this.orbitControls.target.copy(boxCenter);

            this.camera.position.copy(boxCenter).add(new THREE.Vector3(-boxSize.x * 1.5, new THREE.Vector2(boxSize.x, boxSize.y).length(), -boxSize.z * 1.5));
            this.orbitControls.update();

            /**
             * ENVIRONMENT
             */

            // Parameters
            const phi = THREE.MathUtils.degToRad(90);  // closer to horizon
            const theta = THREE.MathUtils.degToRad(100);

            // Sky
            const sky = new Sky();
            sky.scale.setScalar( boxSize.length() * 10 );
            sky.material.uniforms.sunPosition.value.setFromSphericalCoords(1, phi, theta);
            this.scene.add(sky);

            // Environment
            const pmremGenerator = new THREE.PMREMGenerator( this.renderer );
            this.scene.environment = pmremGenerator.fromScene(sky).texture;

            // Lighting
            const sunLight = new THREE.DirectionalLight(0xffffff, 3);
            sunLight.position.setFromSphericalCoords(100, phi, theta);
            this.scene.add(sunLight);
            sunLight.castShadow = true;
            sunLight.shadow.bias = -0.0001;
            sunLight.shadow.mapSize.set(2048, 2048);

            // Post process
            const composer = new EffectComposer(this.renderer);
            composer.addPass(new RenderPass(this.scene, this.camera));
            composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.5, 0.4, 0.85));

            this.render();
        }, undefined, (error) => {
            console.error('Error loading GLB:', error);
        });
    }

    render() {
        if (this.camera && this.scene)
            this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        if (this.camera && this.scene) {
            this.camera.aspect = this.container.offsetWidth / this.container.offsetHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(this.container.offsetWidth, this.container.offsetHeight);
            this.render()
        }
    }

}

export {ThreeRenderer}