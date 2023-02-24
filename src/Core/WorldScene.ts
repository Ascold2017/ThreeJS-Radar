
import { Mesh, MeshStandardMaterial, PlaneGeometry, PointLight, Scene, SphereGeometry } from "three";

import TerrainGenerator from "./TerrainGenerator";

export default class WorldScene {
    readonly scene = new Scene();
    readonly mapSize = 1000;
    private gain = 0.9;
    private radarHeight = 3;

    constructor() {
        this.initScene()
    }

    private async initScene() {
        const terrainGenerator = new TerrainGenerator();
        const { data, width, height } = await terrainGenerator.generateHeightmapFromGoogleMaps(28)
        const light = new PointLight(0xffffff, this.gain, 1000);
        light.position.set(0, 0, -this.radarHeight);
        light.castShadow = true;
        this.scene.add(light)
        this.createPlaneTerrain(data, width, height);
    }

    addTarget(name: string, position: { x: number, y: number, z: number }, visibilityK: number) {

        const target = new Mesh(new SphereGeometry(3), new MeshStandardMaterial({ color: 0x00ff00, opacity: visibilityK }));
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

    
        const terrainMesh = new Mesh(terrainGeometry, new MeshStandardMaterial({ color: 0x00ff00 }));
        terrainMesh.receiveShadow = true;
        terrainMesh.castShadow = true;
        terrainMesh.name = 'terrain';
        terrainMesh.rotateX(180 * (Math.PI / 180))

        this.scene.add(terrainMesh);
    }
}