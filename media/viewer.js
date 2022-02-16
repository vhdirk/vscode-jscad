
function acquireVsCodeApi(){
    return null;
}



// main logic (pass global reference to VSCode WebView API)
(function (vscode) {
    window.addEventListener('DOMContentLoaded', () => {
        // create our custom preview handler (@TODO: pass options)
        const rootEl = document.createElement('div')
        document.body.appendChild(rootEl)
        rootEl.className = 'wrapper'


        const container = document.getElementById('jscad')
        const jscadInst1 = jscadWeb(container, { name: 'jscad1' })

        //
        // const el1 = document.createElement('div')
        // el1.className = 'jscad1'
        // const jscadInst1 = makeJscad(el1, { name: 'jscad1', logging: false })
        // rootEl.appendChild(el1)

        // const preview = new JSCADPreview(vscode, gProcessor, '#viewerContext');
    });
}(acquireVsCodeApi()));