import { WebGLRenderer, OrthographicCamera } from "three";
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
    private cameraPPI: OrthographicCamera | null = null;
    private rotationPPI = 0;
    private readonly antennaHeight = 35;
    private gain = 0.9;
    constructor(container: string) {
        super();
        const containerEl = document.getElementById(container);
        this.worldScene = new WorldScene();
        this.renderer = new WebGLRenderer({ alpha: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(800, 800);
        this.setupCameraPPI();
        this.initFlyObjects();
        containerEl?.appendChild(this.renderer.domElement);
        containerEl?.appendChild(this.createIndicatorScreen());
        this.addLoop('renderLoop', () => {
            this.updatePPI();
            this.renderer.render(this.worldScene.scene, this.cameraPPI!);
        })
    }

    initFlyObjects() {
        const data = [
            { name: 'Target01', position: { x: 100, y: 100, z: 100 }, visibilityK: 0.8 },
            { name: 'Target02', position: { x: 170, y: 120, z: 180 }, visibilityK: 0.8 },
            { name: 'Target03', position: { x: 70, y: 20, z: 80 }, visibilityK: 0.8 },
        ];

        data.forEach(i => {
            const t = this.worldScene.addTarget(i.name, i.position, i.visibilityK);
            this.addFixedLoop(i.name, 7, () => {
                t.position.x += 3;
                t.position.y += 3;

            })
        })
    }

    private setupCameraPPI() {
        this.cameraPPI = new OrthographicCamera(-this.worldScene.mapSize / 2, this.worldScene.mapSize / 2, -this.worldScene.mapSize / 2, this.worldScene.mapSize / 2, 0, 200);
        this.cameraPPI.position.set(0, 0, 100);
    }

    private updatePPI() {
        this.rotationPPI += 1;
        if (this.rotationPPI >= 360) {
            this.rotationPPI = 0;
        }
        this.worldScene.updateUniforms({ rotation: this.rotationPPI, gain: this.gain, antennaHeight: this.antennaHeight })
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