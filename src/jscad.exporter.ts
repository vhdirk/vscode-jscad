import * as cp from 'child_process';
import * as vscode from 'vscode';

export class JSCADExporter {
  private _extensionPath: string;
  private _channel: vscode.OutputChannel;

  public constructor(private context: vscode.ExtensionContext) {
    this._extensionPath = context.extensionPath;
    this._channel = vscode.window.createOutputChannel('JSCAD');
  }

  async command(commandLine: string): Promise<boolean> {
    try {
      let { stdout, stderr } = await this._exec(commandLine, { cwd: this._extensionPath });
      if (stderr && stderr.length > 0) {
          console.log(stderr);
          this._channel.appendLine(stderr);
          this._channel.show(true);
      }
      if (stdout) {
          console.log(stdout);
      }
    } catch (err: any) {
      if (err.stderr) {
        this._channel.appendLine(err.stderr);
      }
      if (err.stdout) {
        this._channel.appendLine(err.stdout);
      }
      this._channel.appendLine('Export JSCAD as STL failed.');
      this._channel.show(true);

      return false;
    }

    return true;
  }

  // Execute child process (taken from the task-provider-sample extension)
  _exec(command: string, options: cp.ExecOptions): Promise<{ stdout: string; stderr: string }> {
    return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      cp.exec(command, options, (error, stdout, stderr) => {
        if (error) {
            reject({ error, stdout, stderr });
        }
        resolve({ stdout, stderr });
      });
    });
  }
}
