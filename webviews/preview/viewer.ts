import { LitElement, html, css } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';

import * as ReGLRenderer from '@jscad/regl-renderer';
import { pointerGestures } from 'most-gestures';

// const { prepareRender, drawCommands, cameras, entitiesFromSolids } = ReGLRenderer
// const perspectiveCamera = cameras.perspective
// const orbitControls = ReGLRenderer.controls.orbit

export interface ViewerRenderingOptions {
    meshColor: any;
    background: any;
}

export interface ViewerGLOptions {
    gl: any,
    optionalExtensions?: string[];
}

export interface ViewerOptions {
    glOptions: ViewerGLOptions;
    camera: any;
    drawCommands: {
        // draw commands bootstrap themselves the first time they are run
        drawAxis: any;
        drawGrid: any;
        drawLines:any;
        drawMesh: any;
    },
    // data
    entities: any[],
    rendering?: ViewerRenderingOptions;
}

const viewer = {
    rendering: {
        background: [1, 1, 1, 1],
        meshColor: [0, 0.6, 1, 1],
        autoRotate: false,
        autoZoom: false
    },
    grid: {
        show: false,
        color: [1, 1, 1, 0.1]
    },
    axes: {
        show: true
    },
    camera: {
        position: ''
    }
}

@customElement('cad-viewer')
export class Viewer extends LitElement {
    // Define scoped styles right with your component, in plain CSS
    static styles = css`
    :host {
    }
  `;

    @query('#renderTarget')
    canvas;

    // Params
    @property()
    rotateSpeed: number = 0.002;

    @property()
    panSpeed: number = 1;

    @property()
    zoomSpeed: number = 0.08;

    @property()
    width: number = 0;

    @property()
    height: number = 0;

    // internal state
    mustRender = false;
    viewerOptions!: ViewerOptions;
    camera = ReGLRenderer.cameras.perspective.defaults;
    controls = ReGLRenderer.controls.orbit.defaults;
    rotateDelta = [0, 0];
    panDelta = [0, 0];
    zoomDelta = 0;
    zoomToFit = false;
    updateView = true;

    prevEntities = [];
    prevSolids = [];
    prevColor = [];

    grid = { // command to draw the grid
        visuals: {
            drawCmd: 'drawGrid',
            show: true,
            color: [0, 0, 0, 1],
            subColor: [0, 0, 1, 0.5],
            fadeOut: false,
            transparent: true
        },
        size: [200, 200],
        ticks: [10, 1]
    };

    axes = { // command to draw the axes
        visuals: {
            drawCmd: 'drawAxis',
            show: true
        }
    };

    idCounter = Date.now();


    constructor() {
        super();
        // let {viewerOptions, camera, err} = this.setup() as any;
        // this.viewerOptions = viewerOptions;
        // this.camera = camera;

    }

    // Render the UI as a function of component state
    render() {
        return html`<canvas id='renderTarget'></canvas>`;
    }

    setup() {
        // prepare the camera
        let error;
        const camera = Object.assign({}, ReGLRenderer.cameras.perspective.defaults);
        camera.position = [150, -180, 233];

        const { gl, type } = this.createContext(this.canvas);

        const viewerOptions: ViewerOptions = {
            glOptions: { gl },
            camera,
            drawCommands: {
                // draw commands bootstrap themselves the first time they are run
                drawAxis: ReGLRenderer.drawCommands.drawAxis,
                drawGrid: ReGLRenderer.drawCommands.drawGrid,
                drawLines: ReGLRenderer.drawCommands.drawLines,
                drawMesh: ReGLRenderer.drawCommands.drawMesh
            },
            // data
            entities: []
        };
        if (type === 'webgl') {
            if (gl.getExtension('OES_element_index_uint')) {
                viewerOptions.glOptions.optionalExtensions = ['oes_element_index_uint'];
            }
        }
        return { viewerOptions, camera, error };
    }

    createContext(canvas, contextAttributes?) {
        const getWebGLContext = (type) => {
            try {
                // NOTE: older browsers may return null from getContext()
                const context = canvas.getContext(type);
                return context ? { gl: context, type } : null;
            } catch (e) {
                return null;
            }
        };
        return (
            getWebGLContext('webgl2') ||
            getWebGLContext('webgl') ||
            getWebGLContext('experimental-webgl') ||
            getWebGLContext('webgl-experimental')
        );
    }


    compareSolids(current, previous) {
        // add an id to each solid if not already
        current = current.map((s) => {
            if (!s.id) {s.id = ++this.idCounter;}
            return s;
        });
        // check if the solids are the same
        if (!previous) {return false;}
        if (current.length !== previous.length) {return false;}
        return current.reduce((acc, id, i) => acc && current[i].id === previous[i].id, true);
    }

    resize(viewerElement) {
        const pixelRatio = window.devicePixelRatio || 1;
        const bounds = viewerElement.getBoundingClientRect();

        const width = (bounds.right - bounds.left) * pixelRatio;
        const height = (bounds.bottom - bounds.top) * pixelRatio;

        const prevWidth = this.width;
        const prevHeight = this.height;

        if (prevWidth !== width || prevHeight !== height) {
            this.width = width;
            this.height = height;

            ReGLRenderer.cameras.perspective.setProjection(this.camera, this.camera, { width, height });
            ReGLRenderer.cameras.perspective.update(this.camera, this.camera);
        }
    }

    doRotatePanZoom() {
        if (this.rotateDelta[0] || this.rotateDelta[1]) {
            const updated = ReGLRenderer.controls.orbit.rotate({ controls:this.controls, camera: this.camera, speed: this.rotateSpeed }, this.rotateDelta);
            this.rotateDelta = [0, 0];
            this.controls = { ...this.controls, ...updated.controls };
            this.updateView = true;
        }

        if (this.panDelta[0] || this.panDelta[1]) {
            const updated = ReGLRenderer.controls.orbit.pan({ controls: this.controls, camera: this.camera, speed: this.panSpeed }, this.panDelta);
            this.panDelta = [0, 0];
            this.camera.position = updated.camera.position;
            this.camera.target = updated.camera.target;
            this.updateView = true;
        }

        if (this.zoomDelta) {
            const updated = ReGLRenderer.controls.orbit.zoom({ controls: this.controls, camera: this.camera, speed: this.zoomSpeed }, this.zoomDelta);
            this.controls = { ...this.controls, ...updated.controls };
            this.zoomDelta = 0;
            this.updateView = true;
        }

        if (this.zoomToFit) {
            this.controls.zoomToFit.tightness = 1.5;
            const updated = ReGLRenderer.controls.orbit.zoomToFit({ controls: this.controls, camera: this.camera, entities: this.prevEntities });
            this.controls = { ...this.controls, ...updated.controls };
            this.zoomToFit = false;
            this.updateView = true;
        }
    }

    renderView() {

        const render = ReGLRenderer.prepareRender(this.viewerOptions);
        const gestures = pointerGestures(this.canvas);

        window.addEventListener('resize', (evt) => { this.updateView = true; });

        // rotate & pan
        gestures.drags
            .forEach((data) => {
                const ev = data.originalEvents[0];
                const { x, y } = data.delta;
                const shiftKey = (ev.shiftKey === true) || (ev.touches && ev.touches.length > 2);
                if (shiftKey) {
                    this.panDelta[0] += x;
                    this.panDelta[1] += y;
                } else {
                    this.rotateDelta[0] -= x;
                    this.rotateDelta[1] -= y;
                }
            });

        // zoom
        gestures.zooms
            .forEach((x) => {
                this.zoomDelta -= x;
            });

        // auto fit
        gestures.taps
            .filter((taps) => taps.nb === 2)
            .forEach((x) => {
                this.zoomToFit = true;
            });


        window.requestAnimationFrame(this.updateAndRender.bind(this));
    }

    updateSolids(state: any) {
        // only generate entities when the solids change
        // themes, options, etc also change the viewer state
        const solids = state.design.solids;
        if (this.prevSolids) {
            const theme = state.themes.themeSettings.viewer;
            const color = theme.rendering.meshColor;
            const sameColor = this.prevColor === color;
            const sameSolids = this.compareSolids(solids, this.prevSolids);
            if (!(sameSolids && sameColor)) {
                this.prevEntities = ReGLRenderer.entitiesFromSolids({ color }, solids);
                this.prevColor = color;

                this.zoomToFit = state.viewer.rendering.autoZoom;
            }
        }
        this.prevSolids = solids;

        if (state.themes && state.themes.themeSettings) {
            const theme = state.themes.themeSettings.viewer;
            this.grid.visuals.color = theme.grid.color;
            this.grid.visuals.subColor = theme.grid.subColor;

            if (this.viewerOptions.rendering) {
                this.viewerOptions.rendering.background = theme.rendering.background;
                this.viewerOptions.rendering.meshColor = theme.rendering.meshColor;
                this.updateView = true;
            }
        }

        this.viewerOptions.entities = [
            state.viewer.grid.show ? this.grid : undefined,
            state.viewer.axes.show ? this.axes : undefined,
            ...this.prevEntities
        ].filter((x) => x !== undefined);

        // special camera commands
        if (state.viewer.camera.position !== '') {
            const adjustment = ReGLRenderer.cameras.camera.toPresetView(state.viewer.camera.position, { camera: this.camera });
            this.camera.position = adjustment.position;
            ReGLRenderer.cameras.perspective.update(this.camera);

            state.viewer.camera.position = '';
        }
        if (state.viewer.rendering) {
            this.controls.autoRotate.enabled = state.viewer.rendering.autoRotate;
        }
    }

    // the heart of rendering, as themes, controls, etc change
    updateAndRender(timestamp) {
        this.doRotatePanZoom();

        if (this.updateView) {
            const updated = ReGLRenderer.controls.orbit.update({ controls: this.controls, camera: this.camera });
            this.controls = { ...this.controls, ...updated.controls };
            this.updateView = this.controls.changed; // for elasticity in rotate / zoom

            this.camera.position = updated.camera.position;
            ReGLRenderer.cameras.perspective.update(this.camera);

            this.resize(this.canvas);

            if (!this.render) {
                this.renderView();
            } else {
                this.updateSolids({});
            }
        }

        window.requestAnimationFrame(this.updateAndRender.bind(this));
    }

}



// const viewer = (state, i18n) => {
//     const el = html`<canvas id='renderTarget'> </canvas>`

//     if (!render) {
//         const options = setup(el)
//         if (options.error) return html`<b style="color:red; background:white; position:fixed; z-index:10; top:50%">${options.error}</b>`
//         viewerOptions = options.viewerOptions
//         camera = options.camera
//         render = prepareRender(viewerOptions)
//         const gestures = pointerGestures(el)

//         window.addEventListener('resize', (evt) => { updateView = true })

//         // rotate & pan
//         gestures.drags
//             .forEach((data) => {
//                 const ev = data.originalEvents[0]
//                 const { x, y } = data.delta
//                 const shiftKey = (ev.shiftKey === true) || (ev.touches && ev.touches.length > 2)
//                 if (shiftKey) {
//                     panDelta[0] += x
//                     panDelta[1] += y
//                 } else {
//                     rotateDelta[0] -= x
//                     rotateDelta[1] -= y
//                 }
//             })

//         // zoom
//         gestures.zooms
//             .forEach((x) => {
//                 zoomDelta -= x
//             })

//         // auto fit
//         gestures.taps
//             .filter((taps) => taps.nb === 2)
//             .forEach((x) => {
//                 zoomToFit = true
//             })


//         // the heart of rendering, as themes, controls, etc change
//         const updateAndRender = (timestamp) => {
//             doRotatePanZoom()

//             if (updateView) {
//                 const updated = orbitControls.update({ controls, camera })
//                 controls = { ...controls, ...updated.controls }
//                 updateView = controls.changed // for elasticity in rotate / zoom

//                 camera.position = updated.camera.position
//                 perspectiveCamera.update(camera)

//                 resize(el)
//                 render(viewerOptions)
//             }

//             window.requestAnimationFrame(updateAndRender)
//         }
//         window.requestAnimationFrame(updateAndRender)
//     } else {
//         // only generate entities when the solids change
//         // themes, options, etc also change the viewer state
//         const solids = state.design.solids
//         if (prevSolids) {
//             const theme = state.themes.themeSettings.viewer
//             const color = theme.rendering.meshColor
//             const sameColor = prevColor === color
//             const sameSolids = compareSolids(solids, prevSolids)
//             if (!(sameSolids && sameColor)) {
//                 prevEntities = entitiesFromSolids({ color }, solids)
//                 prevColor = color

//                 zoomToFit = state.viewer.rendering.autoZoom
//             }
//         }
//         prevSolids = solids

//         if (state.themes && state.themes.themeSettings) {
//             const theme = state.themes.themeSettings.viewer
//             grid.visuals.color = theme.grid.color
//             grid.visuals.subColor = theme.grid.subColor

//             if (viewerOptions.rendering) {
//                 viewerOptions.rendering.background = theme.rendering.background
//                 viewerOptions.rendering.meshColor = theme.rendering.meshColor
//                 updateView = true
//             }
//         }

//         viewerOptions.entities = [
//             state.viewer.grid.show ? grid : undefined,
//             state.viewer.axes.show ? axes : undefined,
//             ...prevEntities
//         ].filter((x) => x !== undefined)

//         // special camera commands
//         if (state.viewer.camera.position !== '') {
//             const adjustment = cameras.camera.toPresetView(state.viewer.camera.position, { camera })
//             camera.position = adjustment.position
//             perspectiveCamera.update(camera)

//             state.viewer.camera.position = ''
//         }
//         if (state.viewer.rendering) {
//             controls.autoRotate.enabled = state.viewer.rendering.autoRotate
//         }
//     }

//     return el
// }





