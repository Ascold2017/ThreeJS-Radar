import { Layer } from "konva/lib/Layer";
import { Circle } from "konva/lib/shapes/Circle";
import { Line } from "konva/lib/shapes/Line";
import { Text } from "konva/lib/shapes/Text";
import { Stage } from "konva/lib/Stage";
import { Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, SphereGeometry, WebGLRenderer } from "three";
import LoopHelper from "./LoopHelper";
import TerrainGenerator from "./TerrainGenerator";

export default class Core {
    private readonly renderer: WebGLRenderer;
    private readonly scene: Scene;
    private camera: OrthographicCamera | null = null;
    private readonly mapSize = 1000;
    private readonly antennaHeight = 35;
    private terrainMesh: Mesh | null = null;
    private target: Mesh | null = null;
    private rotation: number = 0;
    private gain = 0.7;
    constructor(canvas: HTMLCanvasElement) {
        this.renderer = new WebGLRenderer({ canvas, alpha: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(800, 800);
        this.renderer.shadowMap.enabled = true;
        this.scene = new Scene();
        const loopHelper = new LoopHelper();
        this.initScene().then(() => {
            loopHelper.addLoop('renderLoop', () => this.render());
            loopHelper.addLoop('targetFly', () => {
                this.target!.position.x -= 0.1;
                this.target!.position.y -= 0.2;
                this.rotation += 1;
                if (this.rotation >= 360) {
                    this.rotation = 0;
                }
                this.updateTerrainUniforms();
                this.updateTargetUniforms()

            })
        });
        this.createIndicatorScreen();
    }

    async initScene() {
        const terrainGenerator = new TerrainGenerator();
        const { data, width, height } = await terrainGenerator.generateHeightmapFromGoogleMaps(28)

        this.createPlaneTerrain(data, width, height);
        this.setupCamera();
        this.createTarget();

    }

    createIndicatorScreen() {
        const stage = new Stage({
            container: 'indicatorContainer',
            width: 840,
            height: 840
        });
        const layer = new Layer();


        const circle = new Circle({
            x: stage.width() / 2,
            y: stage.width() / 2,
            radius: stage.width() / 2 - 20,
            stroke: 'white',
            strokeWidth: 4
        });

        layer.add(circle);
        const outerRadius = stage.width() / 2 - 20;
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
        const layer2 = new Layer();

        let x0 = stage.width() / 2;
        let y0 = stage.width() / 2;
        let x1 = stage.width() / 2 * Math.cos(this.rotation * (Math.PI / 180) - Math.PI / 2) + stage.width() / 2 - 20;
        let y1 = stage.width() / 2 * Math.sin(this.rotation * (Math.PI / 180) - Math.PI / 2) + stage.width() / 2 - 20;
        const verticeLine = new Line({
            points: [x0, y0, x1, y1],
            stroke: 'yellow',
            strokeWidth: 2,
        });


        //layer2.add(verticeLine)
        stage.add(layer2)
        layer.draw();
    }

    createTarget() {
        const shaderMaterial = new ShaderMaterial({
            uniforms: {
                uLightPosition: { value: [0, 0, -this.antennaHeight] },
                uGain: { value: this.gain },
                uAngle: { value: this.rotation },
                uRange: { value: this.mapSize / 2 },
                uVisibilityK: { value: 0.8 }
            },
            vertexShader: `
                uniform vec3 uLightPosition;
                uniform float uAngle;
                uniform float uVisibilityK;
                varying float vLightWeighting;
                varying float vAngleCoef;
                varying float dx;
                varying float dy;
                const float PI = 3.14159265358979;
                
                void main() {
                    vec4 worldPosition = vec4(modelMatrix * vec4(position, 1.0));
                    dx = worldPosition.x - uLightPosition.x;
	                dy = worldPosition.y - uLightPosition.y;
                    float angleRad = uAngle * PI / 180.0;
                    vec3 angleDirection = vec3(sin(angleRad), cos(angleRad), 0.0);
                    vec3 lightDirection = normalize(vec3(dx,dy,0));
                    
                    float height = -uLightPosition.z;
                    float coef = worldPosition.z / height;
                    if (coef > 1.0) coef = 1.0;
                    vLightWeighting = coef * uVisibilityK;

                    vec3 p = cross(angleDirection,lightDirection);
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
                uniform float uRange;
                uniform float uGain;
                varying float vLightWeighting;
                varying float vAngleCoef;
                varying float dx;
                varying float dy;
                void main() {
                    float r = sqrt(dx * dx + dy * dy);
                    if (r > uRange) {
                        discard;
                    } else {
                        if (vLightWeighting * vAngleCoef <= (1.0 - uGain)) {
                            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
                        } else {
                            gl_FragColor = vec4(1.0, 1.0, 0.0, 1.0) * vLightWeighting * vAngleCoef;
                        }
                    }
                    
                }
            `
        });
        const target = new Mesh(new SphereGeometry(3), shaderMaterial)
        target.position.set(300, 300, 25);
        this.target = target;
        this.scene.add(target)
    }

    async setupCamera() {
        this.camera = new OrthographicCamera(-this.mapSize / 2, this.mapSize / 2, -this.mapSize / 2, this.mapSize / 2, 0, 200);
        this.camera.position.set(0, 0, 100);
        this.camera.lookAt(this.terrainMesh!.position)
    }

    async createPlaneTerrain(data: Float32Array, widthSegments: number, heightSegments: number) {

        const terrainGeometry = new PlaneGeometry(this.mapSize, this.mapSize, widthSegments - 1, heightSegments - 1);
        // Apply height data to plane
        data.forEach((h, i) => {
            terrainGeometry.attributes.position.array[i * 3 + 2] = h; // set z-coordinate
        });
        // Update normals
        terrainGeometry.computeVertexNormals();
        terrainGeometry.computeBoundingBox();
        terrainGeometry.computeTangents();
        terrainGeometry.computeBoundingSphere();

        const shaderMaterial = new ShaderMaterial({
            uniforms: {
                uLightPosition: { value: [0, 0, -this.antennaHeight] },
                uGain: { value: this.gain },
                uAngle: { value: this.rotation },
                uRange: { value: this.mapSize / 2 }
            },
            vertexShader: `
                uniform vec3 uLightPosition;
                uniform float uAngle;
                varying float vLightWeighting;
                varying float vAngleCoef;
                varying float dx;
                varying float dy;
                const float PI = 3.14159265358979;
                void main() {
                    dx = position.x - uLightPosition.x;
	                dy = position.y - uLightPosition.y;
                    float angleRad = uAngle * PI / 180.0;
                    vec3 angleDirection = vec3(sin(angleRad),cos(angleRad),0.0);
                    vec3 lightDirection = normalize(vec3(dx,dy,0));
                    vLightWeighting = -dot(normal,lightDirection);

                    vec3 p = cross(angleDirection,lightDirection);
                    // angle b/w vectors
                    float s = dot(angleDirection, lightDirection);
                    float ang = acos(s) * 180.0 / PI;
                    // bring to 0..360
                    if (p[2] < 0.0) ang = 360.0 - ang;
                    // bring to 0..1
                    vAngleCoef = (1.0 - ang / 360.0);

                    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);

                }
            `,
            fragmentShader: `
                uniform float uRange;
                uniform float uGain;
                varying float vLightWeighting;
                varying float vAngleCoef;
                varying float dx;
                varying float dy;
                void main() {
                    float r = sqrt(dx * dx + dy * dy);
                    if (r > uRange) {
                        discard;
                    } else {
                        if (vLightWeighting * vAngleCoef <= (1.0 - uGain)) {
                            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
                        } else {
                            vec3 finalColor = vec3(1.0, 1.0, 0.0) * vLightWeighting * vAngleCoef;
                            gl_FragColor = vec4(finalColor, 1.0);
                        }
                    }
                    
                }
            `
        });
        this.terrainMesh = new Mesh(terrainGeometry, shaderMaterial);
        this.terrainMesh.rotateX(180 * (Math.PI / 180))

        this.scene.add(this.terrainMesh);
    }

    updateTerrainUniforms() {
        this.terrainMesh!.material.uniforms.uAngle.value = this.rotation
    }

    updateTargetUniforms() {
        this.target!.material.uniforms.uAngle.value = this.rotation;
    }

    render() {
        this.renderer.render(this.scene, this.camera!)
    }
}