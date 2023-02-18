export default class TerrainGenerator {
    constructor() { }

    generateHeightmap(heightmapSrc: string, maxHeight: number) {
        return new Promise<{ data: Float32Array, height: number; width: number }>((resolve) => {
            const img = new Image();
            img.src = heightmapSrc;
            img.onload = () => {
                resolve(this.getHeightmapData(img, maxHeight))
            }
        })
    }

    async generateHeightmapFromGoogleMaps(maxHeight: number) {
        const url = new URL('https://maps.googleapis.com/maps/api/staticmap');
        url.searchParams.append('size', '600x600')
        url.searchParams.append('center', '46.4775,30.7326')
        url.searchParams.append('key', 'AIzaSyBssXLU_JBz3-SNLXluyQ_lxCwfqMgOEfw')
        url.searchParams.append('zoom', '10')
        url.searchParams.append('maptype', 'terrain')
        url.searchParams.append('style', 'element:geometry|color:0x000000')
        url.searchParams.append('style', 'element:labels|visibility:off')
        url.searchParams.append('style', 'element:labels.icon|visibility:off')

        return new Promise<{ data: Float32Array, height: number; width: number }>((resolve) => {
            const img = new Image();
            img.src = url.toString();
            img.crossOrigin = '*'
            img.onload = () => {
                resolve(this.getHeightmapData(img, maxHeight))
            }
        })
    }
    private getHeightmapData(img: HTMLImageElement, maxHeight: number) {
       

        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const context = canvas.getContext('2d')!;

        const size = img.width * img.height;
        const data = new Float32Array(size);

        context.drawImage(img, 0, 0);

        for (let i = 0; i < size; i++) {
            data[i] = 0
        }

        const imgd = context.getImageData(0, 0, img.width, img.height);
        const pix = imgd.data;

        let j = 0;
        for (let i = 0; i < pix.length; i += 4) {
            let all = pix[i] + pix[i + 1] + pix[i + 2];
            data[j++] = (all / (3 * 255)) * maxHeight;
        }

        return { data, height: imgd.height, width: imgd.width };
    }



}