import { css, html, LitElement } from "lit";
import { customElement } from "lit/decorators.js";
import WebWorkify from "webworkify-webpack";
import OpenscadOpenJscadParser from '@jscad/openscad-openjscad-translator';


import "./viewer";
import "./viewer-controls";

const EXAMPLE = `

 * Rounded Cuboid
 * @category Creating Shapes
 * @skillLevel 1
 * @description Demonstrating the roundedCuboid() functiom
 * @tags cube, cuboid, shape, 3d, rounded
 * @authors Rene K. Mueller
 * @licence MIT License
 */

const { cuboid, roundedCuboid } = require('@jscad/modeling').primitives

const getParameterDefinitions = () => {
  return [
    { name: 'width', type: 'float', default: 10, caption: 'Width:' },
    { name: 'height', type: 'float', default: 14, caption: 'Height:' },
    { name: 'depth', type: 'float', default: 7, caption: 'Depth:' },
    { name: 'rounded', type: 'choice', caption: 'Round the corners', values: [0, 1], captions: ['No', 'Yes'], default: 1 },
    { name: 'radius', type: 'float', default: 2, caption: 'Corner Radius:' }
  ]
}

/**
 * Create a rounded cuboid with the supplied parameters
 * @param {Number} params.width - The cuboid's width.
 * @param {Number} params.depth - The cuboid's depth.
 * @param {Number} params.height - The cuboid's height.
 * @param {Number} params.rounded - 1 if the cuboid should be rounded, 0 otherwise.
 * @param {Number} params.radius - The cuboid's corner radius.
 * @returns {geometry}
 */
const main = (params) => {
  if (params.rounded === 1) {
    return roundedCuboid({ size: [params.width, params.height, params.depth], roundRadius: params.radius, segments: 32 })
  } else {
    return cuboid({ size: [params.width, params.height, params.depth] })
  }
}

module.exports = { main, getParameterDefinitions }

`;

@customElement('cad-preview')
export class Preview extends LitElement {
  static styles = css`
    :host {
    }
  `;

  worker: Worker;

  constructor(){
    super();

    this.worker = new Worker('../dist/webview-worker.js');
    this.worker.onerror = (error) => this.onWorkerError(error);
    this.worker.onmessage = (message) => this.onWorkerMessage(message);

  }


  onWorkerError(error) {
    console.log("worker error", error);

  }

  onWorkerMessage(message) {
    console.log("worker message", message);
  }

  render() {
    return html`

      <cad-viewer-controls></cad-viewer-controls>
      <!-- bare bones essentials -->
      <!--Status information/errors-->

      status

      <!--Viewer-->
      <cad-viewer></cad-viewer>

      <!--Params-->
      parameters

    `
  }


  setData(data: string) {

    const parsedData = OpenscadOpenJscadParser.parse(data);
    console.log(parsedData);


    // cmd: "generate"
    // filesAndFolders: (1)[…]
    // lookup: { }
    // lookupCounts: { }
    // mainPath: "/module-design/index.js"
    // parameterValues: { }
    // sink: "geometryWorker"
    // vtreeMode: false

    this.worker.postMessage({
      cmd: 'generate',

    });


  }

}


// main logic (pass global reference to VSCode WebView API)
(function (vscode) {
  window.addEventListener('DOMContentLoaded', () => {
    // create our custom preview handler (@TODO: pass options)
    // const preview = new Previewer(vscode);

    const previewElement = document.getElementById('preview') as Preview;
    previewElement.setData(EXAMPLE);

  });
}(acquireVsCodeApi()));
