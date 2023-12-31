#!/usr/bin/env node

function main(): void {
    const command = process.argv[2];

    if (command === 'generate') {
        console.log('Hello, World!');
    } else {
        console.log('Command not recognized.');
    }
}

main();