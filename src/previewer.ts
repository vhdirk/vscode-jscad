import { tmpdir } from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import fs from 'fs';
import {
  window,
  workspace,
  Disposable,
  StatusBarItem,
  StatusBarAlignment,
  Uri,
  ViewColumn,
  WebviewPanel,
  Event,
  EventEmitter,
} from 'vscode';

import { getDesignEntryPoint, getDesignName } from '@jscad/core/src/code-loading/requireDesignUtilsFs';
import { loadDesign } from '@jscad/core/src/code-loading/loadDesign';

import { Worker } from 'worker_threads';
import { join } from 'path';

/**
 * Manages cat coding webview panels
 */
export class Previewer {
  /**
   * Track the currently panel. Only allow a single panel to exist at a time.
   */
  public static readonly viewType = 'jscadPreview';

  private singlePreviewPanel: vscode.WebviewPanel | null = null;
  private singlePreviewPanelSourceUriTarget: Uri | null = null;

  private readonly _extensionPath: string;
  private _disposables: Disposable[] = [];
  private _statusBarItem: StatusBarItem = window.createStatusBarItem(StatusBarAlignment.Left);

  private onDidInitializeEmitter = new EventEmitter<void>();
  protected worker: Worker;

  // public static revive(panel: WebviewPanel, extensionPath: string, state: any): JSCADPreviewPanel {
  //   console.log('JSCADPreviewPanel.revive');
  //   JSCADPreviewPanel.currentPanel = new JSCADPreviewPanel(panel, extensionPath, state);

  //   return JSCADPreviewPanel.currentPanel;
  // }

  public constructor(private context: vscode.ExtensionContext) {
    this._extensionPath = context.extensionPath;
    this.worker = new Worker(join(__dirname, 'worker.js'));
  }

  private getProjectDirectoryPath(
    sourceUri: Uri,
    workspaceFolders: readonly vscode.WorkspaceFolder[] = [],
  ) {
    const possibleWorkspaceFolders = workspaceFolders.filter(
      (workspaceFolder) => {
        return (
          path
            .dirname(sourceUri.path.toUpperCase())
            .indexOf(workspaceFolder.uri.path.toUpperCase()) >= 0
        );
      },
    );

    let projectDirectoryPath;
    if (possibleWorkspaceFolders.length) {
      // We pick the workspaceUri that has the longest path
      const workspaceFolder = possibleWorkspaceFolders.sort(
        (x, y) => y.uri.fsPath.length - x.uri.fsPath.length,
      )[0];
      projectDirectoryPath = workspaceFolder.uri.fsPath;
    } else {
      projectDirectoryPath = "";
    }

    return this.formatPathIfNecessary(projectDirectoryPath);
  }

  /**
 * Format pathString if it is on Windows. Convert `c:\` like string to `C:\`
 * @param pathString
 */
  private formatPathIfNecessary(pathString: string) {
    if (process.platform === "win32") {
      pathString = pathString.replace(
        /^([a-zA-Z])\:\\/,
        (_, $1) => `${$1.toUpperCase()}:\\`,
      );
    }
    return pathString;
  }

  private getDesign(paths) {
    const mainPath = getDesignEntryPoint(fs, paths);
    const filePath = paths[0];
    const designName = getDesignName(fs, paths);
    const designPath = path.dirname(filePath);

    return {
      name: designName,
      path: designPath,
      mainPath
    };

  }

  public async initPreview(sourceUri: vscode.Uri,
    editor: vscode.TextEditor,
    viewOptions: { viewColumn: vscode.ViewColumn; preserveFocus?: boolean },
  ): Promise<void> {

    const isUsingSinglePreview = useSinglePreview();
    let previewPanel: vscode.WebviewPanel;
    if (isUsingSinglePreview && this.singlePreviewPanel) {
      const oldResourceRoot =
        this.getProjectDirectoryPath(
          this.singlePreviewPanelSourceUriTarget as vscode.Uri,
          vscode.workspace.workspaceFolders,
        ) || path.dirname(this.singlePreviewPanelSourceUriTarget?.fsPath as string);
      const newResourceRoot =
        this.getProjectDirectoryPath(
          sourceUri,
          vscode.workspace.workspaceFolders,
        ) || path.dirname(sourceUri.fsPath);
      if (oldResourceRoot !== newResourceRoot) {
        this.singlePreviewPanel.dispose();
        return this.initPreview(sourceUri, editor, viewOptions);
      } else {
        previewPanel = this.singlePreviewPanel;
        this.singlePreviewPanelSourceUriTarget = sourceUri;
      }
    //} else if ( ) {
    // not single-preview and panel for source exists
    } else {
      const localResourceRoots = [
        vscode.Uri.file(this.context.extensionPath),
        vscode.Uri.file(tmpdir()),
        vscode.Uri.file(
          this.getProjectDirectoryPath(
            sourceUri,
            vscode.workspace.workspaceFolders,
          ) || path.dirname(sourceUri.fsPath),
        ),
      ];
      // Otherwise, create a new panel.
      previewPanel = window.createWebviewPanel(Previewer.viewType, `Preview ${path.basename(sourceUri.fsPath)}`, viewOptions,
        {
        // Enable javascript in the webview
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots,
      });

    // Handle messages from the webview
      previewPanel.webview.onDidReceiveMessage(message => {
        console.log('JSCACPreviewPanel: received message', message);
        switch (message.command) {
          case 'initialized':
            // send event as soon as viewer application in webview is ready
            console.log('command: initialize');
            this.onDidInitializeEmitter.fire();
            break;
          case 'alert':
            window.showErrorMessage(message.text);
            break;
          case 'status':
            this.updateStatusbar(message.text);
            break;
          default:
            window.showErrorMessage(`JSCAD: unknown command: ${message.command}`);
        }
      }, null, this.context.subscriptions);


      // unregister previewPanel
      previewPanel.onDidDispose(
        () => {
          this.destroyPreview(sourceUri);
        },
        null,
        this.context.subscriptions,
      );

      if (isUsingSinglePreview) {
        this.singlePreviewPanel = previewPanel;
        this.singlePreviewPanelSourceUriTarget = sourceUri;
      }

    }

    previewPanel.webview.html = this.getWebViewHtml();
    const text = editor.document.getText();

    const des = loadDesign(sourceUri.fsPath, )
    const design = this.getDesign([sourceUri.fsPath]);

    const filesAndFolders = [
      {
        ext: sourceUri.fsPath,
        fullPath: sourceUri.fsPath,
        name: design.name,
        source: text
      }
    ]

    console.log(design);

    previewPanel.webview.postMessage({ command: 'setData', data: { data: text, design } });

  }

  public destroyPreview(sourceUri: Uri) {
    if (useSinglePreview()) {
      this.singlePreviewPanel = null;
      this.singlePreviewPanelSourceUriTarget = null;
      // this.preview2EditorMap = new Map();
      // this.previewMaps = {};
    } else {
      // const previewPanel = this.getPreview(sourceUri);
      // if (previewPanel) {
      //   this.preview2EditorMap.delete(previewPanel);
      //   delete this.previewMaps[sourceUri.fsPath];
      // }
    }
  }
  //   panel: WebviewPanel,
  //   extensionPath: string,
  //   state: any,
  // ) {
  //   this._panel = panel;
  //   this._extensionPath = extensionPath;

  //   // Set the webview's initial html content and pass state
  //   console.log(state);
  //   this._update(state);

  //   // Listen for when the panel is disposed
  //   // This happens when the user closes the panel or when the panel is closed programatically
  //   this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

  //   // Update the content based on view changes

  //   this._panel.onDidChangeViewState(e => {
  //     console.log('JSCADPreviewPanel.onDidChangeViewState');
  //     if (this._panel.visible) {
  //       // @FIXME: this causes hard reloads, which we really only want after editor changes
  //       // this._update()
  //     }
  //   }, null, this._disposables);

  //   // Handle messages from the webview
  //   this._panel.webview.onDidReceiveMessage(message => {
  //     console.log('JSCACPreviewPanel: received message', message);
  //     switch (message.command) {
  //       case 'initialized':
  //         // send event as soon as viewer application in webview is ready
  //         console.log('command: initialize');
  //         this.onDidInitializeEmitter.fire();
  //         break;
  //       case 'alert':
  //         window.showErrorMessage(message.text);
  //         break;
  //       case 'status':
  //         this.updateStatusbar(message.text);
  //         break;
  //       default:
  //         window.showErrorMessage(`JSCAD: unknown command: ${message.command}`);
  //     }
  //   }, null, this._disposables);
  // }

  public get onDidInitialize(): Event<void> {
    console.log('JSCADPreviewPanel.onDidInitialize');
		return this.onDidInitializeEmitter.event;
  }

  public updateStatusbar(status: string) {
    // Get the current text editor
    let editor = window.activeTextEditor;
    if (!editor) {
      this._statusBarItem.hide();
      return;
    }

    let doc = editor.document;

    // Only update status if a JSCAD file
    if (doc.languageId === "javascript") {
      // Update the status bar
      this._statusBarItem.text = `JSCAD: ${status}`;
      this._statusBarItem.tooltip = 'JSCAD processor status';
      this._statusBarItem.command = 'jscadEditor.openPreview';
      this._statusBarItem.show();
    } else {
      this._statusBarItem.hide();
    }
  }

  public dispose() {
    console.log('dispose');
    // JSCADPreviewPanel.currentPanel = undefined;

    // // Clean up our resources
    // this._panel.dispose();
    this._statusBarItem.dispose();
    this.onDidInitializeEmitter.dispose();

    // @TODO: cleanup othe resources    !

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  /**
   * Set the JSCAD data inside the viewer.
   * @param data JSCAD code to be executed
   * @param fileName Filename shown inside the preview
   */
  public updateSCAD(data: string, fileName?: string) {
    const displayName: string = fileName ? path.basename(fileName) : '';

    // TODO
    // this._panel.webview.postMessage({ command: 'setData', data: { data, fileName } });
    // this._panel.title = `Preview${fileName ? ` of ${displayName}` : ''}`;
    // this._panel.iconPath = Uri.file(path.join(this._extensionPath, 'resources', 'Icon_View_Empty.svg'));
  }

  private _update(state: any = {}) {
    console.log('JSCADPreviewPanel._update');
    //TODO
    // this._panel.webview.html = this._getHtmlForWebview(state);
  }

  private getWebViewHtml() {
    // Local path to main script run in the webview
    const jscadScript = Uri.file(path.join(this._extensionPath, 'dist', 'webview-preview.js'));
    const jscadEditorCSS = Uri.file(path.join(this._extensionPath, 'media', 'preview.css'));

    // And the uri we use to load this script in the webview
    const jscadScriptUri = jscadScript.with({ scheme: 'vscode-resource' });
    const cssUri = jscadEditorCSS.with({ scheme: 'vscode-resource' });

    // Use a nonce to whitelist which scripts can be run (@FIXME: temporarily removed)
    const nonce = getNonce();

    // inject our configuration options via JSON (@FIXME: ugly, only works on hard reload of viewer panel)
    const config = workspace.getConfiguration('jscad');
    const options = {
      defaultFaceColor: config.get('defaultFaceColor'),
    };

    return `<!DOCTYPE html>
    <html>
    <head>
      <meta http-equiv="content-type" content="text/html; charset=UTF-8"/>
      <!-- <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src vscode-resource: https:; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}';"> -->
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="stylesheet" href="${cssUri}" nonce="${nonce}" type="text/css">
      <meta name="jscad-config" content='${JSON.stringify(options)}' />
    </head>
    <body>
      <div id='jscad'></div>

      <script nonce="${nonce}" src="${jscadScriptUri}"></script>
    </body>

    </html>`;
  }
}

function getNonce() {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export function useSinglePreview() {
  // const config = vscode.workspace.getConfiguration("jscad");
  // return config.get<boolean>("singlePreview");
  //TODO: we only support one panel for now
  return true;
}
