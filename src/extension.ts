// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { JSCADEditorController } from './jscad-editor.controller';
import { Previewer } from './previewer';
import { JSCADExporter } from './jscad.exporter';
import { JSCADIntellisenseProvider } from './jscad-intellisense.provider';
import { ImportPathFromSVGAction } from './actions/import-path-from-svg.action';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  console.log('vscode-jscad-editor active');

  const previewer = new Previewer(context);

  function openPreview(uri?: vscode.Uri) {
    console.log('jscad.openPreview: command runs');

    let resource = uri;
    if (!(resource instanceof vscode.Uri)) {
      if (vscode.window.activeTextEditor) {
        // we are relaxed and don't check for markdown files
        resource = vscode.window.activeTextEditor.document.uri;
      }
    }
    previewer.initPreview(resource as vscode.Uri, vscode.window.activeTextEditor as vscode.TextEditor, {
      viewColumn: vscode.ViewColumn.One,
      preserveFocus: false,
    });
  }

  function webviewFinishLoading(uri: string) {
    const sourceUri = vscode.Uri.parse(uri);
    previewer.updateSCAD(sourceUri);
  }



  // create and register our editor controller
  const controller = new JSCADEditorController();
  context.subscriptions.push(controller);

  // create our exporter (@TODO: dispose)
  const exporter = new JSCADExporter(context);

  // register our custom intellisense provider
  const intellisenseProvider = new JSCADIntellisenseProvider();

  // add commands

  context.subscriptions.push(vscode.commands.registerCommand('jscad.openPreview', openPreview));

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "_jscad.webviewFinishLoading",
      webviewFinishLoading,
    ),
  );

  const exportSTLCommand = vscode.commands.registerCommand('jscad.exportAsSTL', async () => {
    // @NOTE: I am unsure whether this should be a Task instead. We are actually building something
    // but on the other hand this is just a simple export :-| ... should check how other extensions
    // solve this (e.g. less/sass, etc)

    // get active editor
    const editor = vscode.window.activeTextEditor;
    // check if file is really a *.jscad file
    if (editor && editor.document.fileName.match(/\.jscad$/i)) {
      // TODO: open file selection dialog and get desired output name
      // export it to desired format
      const result = await exporter.command(`npx openjscad "${editor.document.fileName}"`);
      if (result) {
        vscode.window.showInformationMessage('JSCAD: STL export succeeded');
      } else {
        vscode.window.showErrorMessage('JSCAD: STL export failed (check task output for details)');
      }
    }
  });

  context.subscriptions.push(exportSTLCommand);

  const importSVGCommand = vscode.commands.registerCommand('jscad.importPathFromSVG', async () => {
    // get active editor
    const editor = vscode.window.activeTextEditor;
    // check if file is really a *.jscad file
    if (editor && editor.document.fileName.match(/\.jscad$/i)) {
      // open file selection dialog and locate SVG file
      const selectedFiles = await vscode.window.showOpenDialog({
        filters: {
          'SVG files': ['svg']
        },
      });
      if (selectedFiles && selectedFiles.length > 0) {
        const importer = new ImportPathFromSVGAction(selectedFiles[0].fsPath);
        const polygonElements = importer.getPolygonsFromSVG();
        if (!polygonElements) {
          vscode.window.showErrorMessage('No <polygon> element found in provided SVG document');
          return;
        }
        /*
        if (polygonElements.length > 1) {
          // show selection list, when multiple paths available
          const elementName = await vscode.window.showQuickPick(['ghi', 'hghgc', '76tz', 'edfghvjb'], {
            placeHolder: 'Choose SVG path object to import'
          });
        }
        */
        const svgString = importer.convertSVGPolygonToJSCADString(polygonElements);
        if (!svgString) {
          vscode.window.showErrorMessage('Failed to comvert <polygon> element to JSCAD. See error output for details.');
          return;
        }
        editor.insertSnippet(new vscode.SnippetString(svgString));
      }
    }
  });

  context.subscriptions.push(importSVGCommand);

  // if (vscode.window.registerWebviewPanelSerializer) {
  //   // Make sure we register a serilizer in activation event
  //   vscode.window.registerWebviewPanelSerializer(JSCADPreviewPanel.viewType, {
  //     async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any) {
  //       console.log(`JSCADPreview activate: restore state ${state}`);
  //       const panel = JSCADPreviewPanel.revive(webviewPanel, context.extensionPath, state);
  //       panel.onDidInitialize(e => {
  //         console.log('INIT DONE');
  //         vscode.window.showInformationMessage('JSCAD Viewer initialized!');
  //         controller.updatePanelWithEditorData();
  //       });
  //     }
  //   });
  // }
}

// this method is called when your extension is deactivated
export function deactivate() {
}
