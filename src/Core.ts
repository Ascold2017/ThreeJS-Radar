import { Layer } from "konva/lib/Layer";
import { Circle } from "konva/lib/shapes/Circle";
import { Line } from "konva/lib/shapes/Line";
import { Text } from "konva/lib/shapes/Text";
import { Stage } from "konva/lib/Stage";
import { Mesh, OrthographicCamera, PlaneGeometry,  Scene, ShaderMaterial, SphereGeometry,  WebGLRenderer } from "three";
import LoopHelper from "./LoopHelper";
import TerrainGenerator from "./TerrainGenerator";

export default class Core {
    private readonly renderer: WebGLRenderer;
    private readonly scene: Scene;
    private camera: OrthographicCamera | null = null;
    private readonly mapSize = 1000;
    private readonly antennaHeight = 25;
    private terrainMesh: Mesh | null = null;
    private target: Mesh | null = null;
    private rotation: number = 0;
    constructor(canvas: HTMLCanvasElement) {
        this.renderer = new WebGLRenderer({ canvas, alpha: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(600, 600);
        this.scene = new Scene();
        const loopHelper = new LoopHelper();
        this.initScene().then(() => {
            loopHelper.addLoop('renderLoop', () => this.render());
            loopHelper.addLoop('targetFly', () => {
                this.target!.position.x -= 0.1;
                this.target!.position.y -= 0.2;
                this.updateTerrainUniforms();
                this.updateTargetUniforms()
                
            })
        });
        this.createIndicatorScreen();
    }

    async initScene() {
        const terrainGenerator = new TerrainGenerator();
        const { data, width, height } = await terrainGenerator.generateHeightmap('/terrain3.png', 28)
        
        this.createPlaneTerrain(data, width, height);
        this.setupCamera(width, height);
        this.createTarget();
        
    }

    createIndicatorScreen() {
        const stage = new Stage({
            container: 'indicatorContainer',
            width: 640,
            height: 640
        });
        const layer = new Layer();
        

        const circle = new Circle({
            x: stage.width() / 2,
            y: stage.width() / 2,
            radius: stage.width() / 2 - 20,
            stroke: 'yellow',
            strokeWidth: 4
        });

        layer.add(circle);
        const outerRadius = stage.width() /2 - 20;
        const innerRadius = stage.width() / 2 - 35;
        for (let i = 0; i< 360; i+=10) {
            let x0 = innerRadius * Math.cos(i * (Math.PI/180) - Math.PI/2) +  stage.width() /2;
            let y0 = innerRadius * Math.sin(i * (Math.PI/180) - Math.PI/2) +  stage.width() /2;;
            let x1 = outerRadius * Math.cos(i * (Math.PI/180) - Math.PI/2) +  stage.width() /2;;
            let y1 = outerRadius * Math.sin(i * (Math.PI/180) - Math.PI/2) +  stage.width() /2;;
            layer.add(new Line({
                points: [x0, y0, x1, y1],
                stroke: 'yellow',
            }));
            layer.add(new Text({
                text: i.toString(),
                x: x0,
                y: y0,
                rotationDeg: i + 180,
                fill: 'yellow',
                fontSize: 13,
                align: 'center',
                width: 50,
                offsetX: 25,
                offsetY: -20
            }))
        }

        layer.add(new Line({
            points: [stage.width() /2 - 20, stage.width()/2, stage.width() /2 + 20, stage.width()/2,],
            stroke: 'yellow',
            strokeWidth: 1
        }))
        layer.add(new Line({
            points: [stage.width() /2, stage.width()/2 - 20, stage.width() /2, stage.width()/2 + 20],
            stroke: 'yellow',
            strokeWidth: 1
        }))
        stage.add(layer);
        layer.draw();
    }

    createTarget() {
        const shaderMaterial = new ShaderMaterial({
            uniforms: {
                uLightPosition: { value:  [0, 0, -this.antennaHeight] },
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
                    vec3 angleDirection = vec3(sin(angleRad),cos(angleRad),0.0);
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
                varying float vLightWeighting;
                varying float vAngleCoef;
                varying float dx;
                varying float dy;
                void main() {
                    float r = sqrt(dx * dx + dy * dy);
                    if (vLightWeighting <= 0.3 || r > uRange) {
                        discard;
                    } else {
                        gl_FragColor = vec4(1.0, 1.0, 0.0, 1.0) * vLightWeighting * vAngleCoef;
                    }
                    
                }
            `
        });
        const target = new Mesh(new SphereGeometry(2), shaderMaterial)
        target.position.set(100, 100, 25);
        this.target = target;
        this.scene.add(target)
    }

    async setupCamera() {
        this.camera = new OrthographicCamera(-this.mapSize /2, this.mapSize /2, -this.mapSize /2, this.mapSize /2, 0, 200);
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
                uLightPosition: { value:  [0, 0, -this.antennaHeight] },
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
                varying float vLightWeighting;
                varying float vAngleCoef;
                varying float dx;
                varying float dy;
                void main() {
                    float r = sqrt(dx * dx + dy * dy);
                    if (vLightWeighting <= 0.6 || r > uRange) {
                        discard;
                    } else {
                        gl_FragColor = vec4(1.0, 1.0, 0.0, 1.0) * vLightWeighting * vAngleCoef;
                    }
                    
                }
            `
        });
        this.terrainMesh = new Mesh(terrainGeometry, shaderMaterial);
        this.terrainMesh.rotateX(180 * (Math.PI / 180))

        this.scene.add(this.terrainMesh);
    }

    updateTerrainUniforms() {
        this.terrainMesh!.material.uniforms.uAngle.value += 1;
        if (this.terrainMesh!.material.uniforms.uAngle.value >= 360) {
            this.terrainMesh!.material.uniforms.uAngle.value = 0;
        }
    }

    updateTargetUniforms() {
        this.target!.material.uniforms.uAngle.value += 1;
        if (this.target!.material.uniforms.uAngle.value >= 360) {
            this.target!.material.uniforms.uAngle.value = 0;
        }
    }

    render() {
        this.renderer.render(this.scene, this.camera!)
    }
}