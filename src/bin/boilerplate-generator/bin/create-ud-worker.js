#! /usr/bin/env node

const program = require('commander');
const pkg = require('../package.json');
const lib = require('..');

const help = function () {
  return `
    Creates a ud worker.
    Params: <project-directory> - path to project directory for the worker.
  `;
};

let projectName;

program
  .version(pkg.version)
  .arguments('<project-directory>')
  .usage('<project-directory> [options]')
  .action(function (name) {
    projectName = name;
  })
  // TODO: Add more options (different templates, etc.)
  .allowUnknownOption()
  .on('--help', help)
  .parse(process.argv);

lib.createUdWorker({
  projectName,
});
