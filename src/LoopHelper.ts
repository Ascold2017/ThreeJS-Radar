interface ILoop {
    func: (time: number) => void;
    isPaused: boolean;
    time: 0;
}

export default class LoopHelper {
    protected loops: Record<string, ILoop> = {};
    protected maxDelta = 0.1;
    protected fps = 75;
    protected lastTime = 0;
    protected isStop = false;
    protected acceleration = 1;
    constructor() {
        this.lastTime = Date.now();
        const render = () => {
            requestAnimationFrame(render)
            this.update()
        }
        render();
    }

    setAcceleration(acc: number) {
        this.acceleration = acc;
        if (acc <= 0) {
            this.isStop = true;
        } else {
            this.isStop = false;
        }
    }

    addLoop(name: string, func: (time: number) => void) {
        this.loops[name] = { func, isPaused: false, time: 0 };
    }
    removeLoop(name: string) {
        delete this.loops[name];
    }

    private update() {
        if (this.isStop) return;
        let delta = ((Date.now() - this.lastTime) / 1000) * this.acceleration;
        if (delta > this.maxDelta) delta = this.maxDelta;

        if (delta < 1 / this.fps) return;

        this.lastTime = Date.now();

        for (const l in this.loops) {
            if (!this.loops[l].isPaused) {
                this.loops[l].time += delta;
                this.loops[l].func(this.loops[l].time);
            }
        }
    }
}