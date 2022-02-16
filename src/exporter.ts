import * as vscode from 'vscode';
import * as fs from 'fs';
import { formats } from '@jscad/io/formats';

import { version as JSCADVersion } from '@jscad/core';

import determineOutputNameAndFormat from '@jscad/cli/src/determineOutputNameAndFormat';
import writeOutput from '@jscad/cli/src/writeOutput';
import parseArgs from '@jscad/cli/src/parseArgs';
import path, { extname } from 'path';
import { generateOutputData } from './generateOutputData';

const clicolors = {
    red: '\u{1b}[31m',
    green: '\u{1b}[32m',
    yellow: '\u{1b}[33m',
    blue: '\u{1b}[34m',
    black: '\u{1b}[0m'
};

export class Exporter {
    private _extensionPath: string;
    private _channel: vscode.OutputChannel;

    public constructor(private context: vscode.ExtensionContext) {
        this._extensionPath = context.extensionPath;
        this._channel = vscode.window.createOutputChannel('JSCAD');
    }

    async exportSTL(resource: vscode.Uri) {
        const inputFile = resource.fsPath;
        const inputExtension = extname(inputFile).substring(1);

        // const filesAndFolders = [
        //     {
        //         ext: 'js',
        //         fullPath: fakePath,
        //         name: fakeName,
        //         source: data.source
        //     }
        // ]

        // // handle arguments (inputs, outputs, etc)
        // const args = process.argv.splice(2)
        // let { inputFile, inputFormat, outputFile, outputFormat, params, addMetaData, inputIsDirectory } = parseArgs(args)


        let outputFormat = "stl";
        let outputFile = path.format({ ...path.parse(inputFile), base: '', ext: '.' + outputFormat });
        const addMetaData = true;
        const params = [];

        const inputIsDirectory = false;
        const version = '';

        // outputs
        const output = determineOutputNameAndFormat(outputFormat, outputFile, inputFile);
        outputFormat = output.outputFormat;
        outputFile = output.outputFile;


        this._channel.appendLine(`
            ${clicolors.blue}JSCAD: generating output ${clicolors.red}
            from: ${clicolors.green} ${inputFile} ${clicolors.red}
            to: ${clicolors.green} ${outputFile} ${clicolors.yellow}(${formats[outputFormat].description}) ${clicolors.black}
        `);

        // read input data
        const src = fs.readFileSync(inputFile); //, inputFile.match(/\.stl$/i) ? 'binary' : 'UTF8')

        // -- convert from JSCAD script into the desired output format
        // -- and write it to disk

        await generateOutputData(src, params, { outputFile, outputFormat, inputFile, inputFormat: inputExtension, version, addMetaData, inputIsDirectory })
            .then((outputData) =>
                writeOutput(outputFile, outputData))
            .catch((error) => {
                console.error(error);
            });


    }

    //   async command(commandLine: string): Promise<boolean> {
    //     try {
    //       let { stdout, stderr } = await this._exec(commandLine, { cwd: this._extensionPath });
    //       if (stderr && stderr.length > 0) {
    //           console.log(stderr);
    //           this._channel.appendLine(stderr);
    //           this._channel.show(true);
    //       }
    //       if (stdout) {
    //           console.log(stdout);
    //       }
    //     } catch (err: any) {
    //       if (err.stderr) {
    //         this._channel.appendLine(err.stderr);
    //       }
    //       if (err.stdout) {
    //         this._channel.appendLine(err.stdout);
    //       }
    //       this._channel.appendLine('Export JSCAD as STL failed.');
    //       this._channel.show(true);

    //       return false;
    //     }

    //     return true;
    //   }

    //   // Execute child process (taken from the task-provider-sample extension)
    //   _exec(command: string, options: cp.ExecOptions): Promise<{ stdout: string; stderr: string }> {
    //     return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    //       cp.exec(command, options, (error, stdout, stderr) => {
    //         if (error) {
    //             reject({ error, stdout, stderr });
    //         }
    //         resolve({ stdout, stderr });
    //       });
    //     });
    //   }
}
