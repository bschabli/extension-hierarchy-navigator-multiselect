import * as path from 'path';

interface WebpackConfiguration {
    output?: {
        environment?: {
            hasOwn?: boolean;
        };
    };
}

function assert(condition: boolean, message: string): void {
    if(!condition) { throw new Error(message); }
}

function loadConfiguration(fileName: string): WebpackConfiguration {
    const configurationPath=path.join(process.cwd(), fileName);
    return require(configurationPath) as WebpackConfiguration;
}

for(const fileName of ['webpack.config.js', 'webpack.config.single.js']) {
    const configuration=loadConfiguration(fileName);
    assert(
        configuration.output?.environment?.hasOwn===false,
        `${ fileName } must not emit Object.hasOwn because older Tableau Desktop runtimes do not support it.`
    );
}

console.log('Webpack compatibility tests passed.');
