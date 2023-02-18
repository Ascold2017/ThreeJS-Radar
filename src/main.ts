import Core from './Core';
import './style.css'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<div id="container">
<canvas width="600" height="600" id="canvas"></canvas>
<div id="indicatorContainer"></div>
</div>
 
`

const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!;
new Core(canvas)