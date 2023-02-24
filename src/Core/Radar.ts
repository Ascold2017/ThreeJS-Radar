import { WebGLRenderer, OrthographicCamera, Scene, WebGLRenderTarget, Mesh, PlaneGeometry, ShaderMaterial } from "three";
import { Layer } from "konva/lib/Layer";
import { Circle } from "konva/lib/shapes/Circle";
import { Line } from "konva/lib/shapes/Line";
import { Text } from "konva/lib/shapes/Text";
import { Stage } from "konva/lib/Stage";
import LoopHelper from "./LoopHelper";
import WorldScene from "./WorldScene";

export default class Radar extends LoopHelper {
    private readonly worldScene: WorldScene;
    private readonly renderer: WebGLRenderer;
    private readonly camera: OrthographicCamera = new OrthographicCamera(-400, 400, -400, 400, 0, 10);

    private ppiScreenRenderTarget: WebGLRenderTarget | null = null;
    private ppiScreenScene: Scene | null = null;
    private ppiCamera: OrthographicCamera | null = null;
    private rotationPPI = 0;
    constructor(container: string) {
        super();
        const containerEl = document.getElementById(container);
        this.worldScene = new WorldScene();

        this.renderer = new WebGLRenderer({ alpha: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(800, 800);
        this.renderer.shadowMap.enabled = true;
        this.setupPPI();
        this.initFlyObjects();

        containerEl?.appendChild(this.renderer.domElement);
        containerEl?.appendChild(this.createIndicatorScreen());
        this.camera.position.y = 5;
        this.camera.rotateX(-180 * (Math.PI / 180));
        this.updatePPI();
        setInterval(() => this.updatePPI(), 5000)
        this.addLoop('renderLoop', () => {
            this.rotationPPI += 1;
            if (this.rotationPPI >= 360) {
                this.rotationPPI = 0;
            }
            this.renderer.render(this.ppiScreenScene!, this.camera);

        })
    }

    setupPPI() {

        this.ppiCamera = new OrthographicCamera(-this.worldScene.mapSize / 2, this.worldScene.mapSize / 2, -this.worldScene.mapSize / 2, this.worldScene.mapSize / 2, 0, 200);
        this.ppiCamera.position.set(0, 0, 100);

        this.ppiScreenRenderTarget = new WebGLRenderTarget(800, 800);

        this.ppiScreenScene = new Scene();
        const shaderMaterial = new ShaderMaterial({
            uniforms: {
                uRadius: { value: 400 },
                uRotation: { value: 0 },
                uTexture: { value: this.ppiScreenRenderTarget.texture }
            },
            vertexShader: `
                uniform float uRotation;
                varying vec2 vUv;
                varying float vAngleCoef;
                varying float dx;
                varying float dy;
                const float PI = 3.14159265358979;

                void main() {
                    vUv = uv;
                    vec4 worldPosition = vec4(modelMatrix * viewMatrix * vec4(position, 1.0));
                    dx = position.x;
                    dy = position.y;
                    vec3 lightDirection = normalize(vec3(dx,dy,0));

                    vec3 angleDirection = vec3(sin(uRotation), cos(uRotation), 0.0);

                    vec3 p = cross(angleDirection, lightDirection);
                    // angle b/w vectors
                    float s = dot(angleDirection, lightDirection);
                    float ang = acos(s) * 180.0 / PI;
                    // bring to 0..360
                    if (p.z < 0.0) ang = 360.0 - ang;
                    // bring to 0..1
                    vAngleCoef = (1.0 - ang / 360.0);
                    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                precision highp float;
                uniform float uRadius;
                uniform sampler2D uTexture;
                varying vec2 vUv;
                varying float vAngleCoef;
                varying float dx;
                varying float dy;
                void main() {
                    float r = sqrt(dx * dx + dy * dy);
                    if (r < uRadius) {
                        gl_FragColor = vec4(texture2D(uTexture, vUv).rgb * vAngleCoef, 1.0);
                    } else {
                        discard;
                    }
                    
                }
            `
        })
        const screenPlane = new Mesh(new PlaneGeometry(800, 800, 799, 799), shaderMaterial);
        this.addLoop('rotationLoop', () => {
            shaderMaterial.uniforms.uRotation.value = this.rotationPPI * (Math.PI / 180);
        })
        this.ppiScreenScene.add(screenPlane);

    }

    initFlyObjects() {
        const data = [
            { name: 'Target01', position: { x: 100, y: 100, z: 100 }, visibilityK: 0.8 },
            { name: 'Target02', position: { x: 170, y: 120, z: 180 }, visibilityK: 0.8 },
            { name: 'Target03', position: { x: 70, y: 20, z: 80 }, visibilityK: 0.8 },
        ];

        data.forEach(i => {
            const t = this.worldScene.addTarget(i.name, i.position, i.visibilityK);
            this.addLoop(i.name, () => {
                t.position.x += 0.3;
                t.position.y += 0.3;

            })
        })
    }

    private updatePPI() {
        this.renderer.setRenderTarget(this.ppiScreenRenderTarget);
        this.renderer.render(this.worldScene.scene, this.ppiCamera!);
        this.renderer.setRenderTarget(null);
    }


    createIndicatorScreen() {
        const container = document.createElement('div');
        container.id = 'indicatorContainer';
        const stage = new Stage({
            container,
            width: 840,
            height: 840
        });
        const layer = new Layer();


        const circle = new Circle({
            x: stage.width() / 2,
            y: stage.width() / 2,
            radius: stage.width() / 2 - 18,
            stroke: 'white',
            strokeWidth: 4
        });

        layer.add(circle);
        const outerRadius = stage.width() / 2 - 18;
        const innerRadius = stage.width() / 20;
        for (let i = 0; i < 360; i += 10) {
            let x0 = innerRadius * Math.cos(i * (Math.PI / 180) - Math.PI / 2) + stage.width() / 2;
            let y0 = innerRadius * Math.sin(i * (Math.PI / 180) - Math.PI / 2) + stage.width() / 2;;
            let x1 = outerRadius * Math.cos(i * (Math.PI / 180) - Math.PI / 2) + stage.width() / 2;;
            let y1 = outerRadius * Math.sin(i * (Math.PI / 180) - Math.PI / 2) + stage.width() / 2;;
            layer.add(new Line({
                points: [x0, y0, x1, y1],
                stroke: 'white',
                strokeWidth: 0.1
            }));
            layer.add(new Text({
                text: i.toString(),
                x: x1,
                y: y1,
                rotationDeg: i,
                fill: 'white',
                fontSize: 13,
                align: 'center',
                width: 50,
                offsetX: 25,
                offsetY: 15
            }))
        }

        for (let r = 0; r < 10; r++) {
            layer.add(new Circle({
                x: stage.width() / 2,
                y: stage.width() / 2,
                radius: (r * (stage.width() / 2)) / 10,
                stroke: 'white',
                strokeWidth: 0.2
            }));
        }
        stage.add(layer);
        layer.draw();
        return container;
    }

}