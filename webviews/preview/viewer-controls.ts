import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement('cad-viewer-controls')
export class ViewerControls extends LitElement {
    // Define scoped styles right with your component, in plain CSS
    static styles = css`
    :host {
    }
  `;

    @property()
    showGrid?: boolean = true;

    @property()
    showAxes?: boolean = true;

    @property()
    autoRotate?: boolean = true;

    @property()
    autoZoom?: boolean = true;

    render() {
        return html`
            <div id='controls'>
                <label for="toggleGrid">Show grid</label>
                <input type="checkbox" id="toggleGrid" ?checked="${this.showGrid}" />
                <label for="toggleAxes">Show axes</label>
                <input type="checkbox" id="toggleAxes" ?checked="${this.showAxes}" />
                <label for="toggleAutoRotate">Auto rotate</label>
                <input type="checkbox" id="toggleAutoRotate" ?checked="${this.autoRotate}" />
                <label for="toggleAutoZoom">Auto zoom</label>
                <input type="checkbox" id="toggleAutoZoom" ?checked="${this.autoZoom}" />
            </div>
        `;
    }
}