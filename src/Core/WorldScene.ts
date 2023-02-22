
import { Mesh, PlaneGeometry, Scene, ShaderMaterial, SphereGeometry } from "three";

import TerrainGenerator from "./TerrainGenerator";

export default class WorldScene {
    readonly scene = new Scene();
    readonly mapSize = 1000;
    private gain = 0.9;
    private radarHeight = 15;

    constructor() {
        this.initScene()
    }

    private async initScene() {
        const terrainGenerator = new TerrainGenerator();
        const { data, width, height } = await terrainGenerator.generateHeightmapFromGoogleMaps(28)

        this.createPlaneTerrain(data, width, height);
    }

    addTarget(name: string, position: { x: number, y: number, z: number }, visibilityK: number) {
        const shaderMaterial = new ShaderMaterial({
            uniforms: {
                uLightPosition: { value: [0, 0, -this.radarHeight] },
                uGain: { value: this.gain},
                uRange: { value: this.mapSize / 2 },
                uVisibilityK: { value: visibilityK }
            },
            vertexShader: `
                uniform vec3 uLightPosition;
                uniform float uVisibilityK;
                varying float vLightWeighting;
                varying float dx;
                varying float dy;
                const float PI = 3.14159265358979;
                
                void main() {
                    vec4 worldPosition = vec4(modelMatrix * vec4(position, 1.0));
                    dx = worldPosition.x - uLightPosition.x;
	                dy = worldPosition.y - uLightPosition.y;
                    vec3 lightDirection = normalize(vec3(dx,dy,0));
                    
                    float height = -uLightPosition.z;
                    float coef = worldPosition.z / height;
                    if (coef > 1.0) coef = 1.0;
                    vLightWeighting = coef * uVisibilityK;

                    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
                    
                }
            `,
            fragmentShader: `
                uniform float uRange;
                uniform float uGain;
                varying float vLightWeighting;
                varying float dx;
                varying float dy;
                void main() {
                    float r = sqrt(dx * dx + dy * dy);
                    if (r > uRange) {
                        discard;
                    } else {
                        if (vLightWeighting <= (1.0 - uGain)) {
                            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
                        } else {
                            gl_FragColor = vec4(1.0, 1.0, 0.0, 1.0) * vLightWeighting;
                        }
                    }
                    
                }
            `
        });
        const target = new Mesh(new SphereGeometry(3), shaderMaterial);
        target.name = name;
        target.position.set(position.x, position.y, position.z);
        this.scene.add(target);
        return target;
    }

    private async createPlaneTerrain(data: Float32Array, widthSegments: number, heightSegments: number) {

        const terrainGeometry = new PlaneGeometry(this.mapSize, this.mapSize, widthSegments - 1, heightSegments - 1);
        // Apply height data to plane
        data.forEach((h, i) => {
            // @ts-ignore
            terrainGeometry.attributes.position.array[i * 3 + 2] = h; // set z-coordinate
        });
        // Update normals
        terrainGeometry.computeVertexNormals();
        terrainGeometry.computeBoundingBox();
        terrainGeometry.computeTangents();
        terrainGeometry.computeBoundingSphere();

        const shaderMaterial = new ShaderMaterial({
            uniforms: {
                uLightPosition: { value: [0, 0, -this.radarHeight] },
                uGain: { value: this.gain},
                uRange: { value: this.mapSize / 2 }
            },
            vertexShader: `
                uniform vec3 uLightPosition;
                varying float vLightWeighting;
                varying float dx;
                varying float dy;
                const float PI = 3.14159265358979;
                void main() {
                    dx = position.x - uLightPosition.x;
	                dy = position.y - uLightPosition.y;
                    vec3 lightDirection = normalize(vec3(dx,dy,0));
                    vLightWeighting = -dot(normal,lightDirection);

                    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);

                }
            `,
            fragmentShader: `
                uniform float uRange;
                uniform float uGain;
                varying float vLightWeighting;
                varying float dx;
                varying float dy;
                void main() {
                    float r = sqrt(dx * dx + dy * dy);
                    if (r > uRange) {
                        discard;
                    } else {
                        if (vLightWeighting <= (1.0 - uGain)) {
                            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
                        } else {
                            vec3 finalColor = vec3(1.0, 1.0, 0.0) * vLightWeighting;
                            gl_FragColor = vec4(finalColor, 1.0);
                        }
                    }
                    
                }
            `
        });
        const terrainMesh = new Mesh(terrainGeometry, shaderMaterial);
        terrainMesh.name = 'terrain';
        terrainMesh.rotateX(180 * (Math.PI / 180))

        this.scene.add(terrainMesh);
    }
}