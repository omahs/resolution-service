const fs = require('fs');
const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

// some utils borrowed from create-next-app
const copyDir = require('./utils/copy-dir');
const output = require('./utils/output');
const cmdInstallType = require('./utils/cmd-install-type');

module.exports = function createUdWorker(opts) {
  const projectName = opts.projectName;
  if (!projectName) {
    console.log(`
     Please specify the project directory: 
     > create-ud-worker <project-directory>
    `);
    process.exit(1);
  }

  if (fs.existsSync(projectName) && projectName !== '.') {
    console.log(`Project directory ${projectName} already exists!`);
    process.exit(1);
  }

  const projectPath = (opts.projectPath = process.cwd() + '/' + projectName);
  const templatePath = path.resolve(__dirname, '../boilerplate/default');

  copyDir({
    templatePath: templatePath,
    projectPath: projectPath,
    projectName: projectName,
  })
    .then(installWithMessageFactory(opts))
    .catch(function (err) {
      throw err;
    });
};

function installWithMessageFactory(opts) {
  const projectName = opts.projectName;
  const projectPath = opts.projectPath;

  const installCmd = cmdInstallType();

  fs.mkdirSync(projectPath);
  process.chdir(projectPath);

  return new Promise(function (resolve, reject) {
    const stopInstallSpinner = output.wait('Installing modules');

    exec(installCmd, ['install'])
      .then(function () {
        stopInstallSpinner();
        output.success(`Installed dependencies for ${projectName}`);
        resolve();
      })
      .catch(function (err) {
        stopInstallSpinner();
        console.log(`Failed to install dependencies.`);
        return reject(new Error(`${installCmd} installation failed`));
      });
  })
    .then(function () {
      console.log(
        `Installed succesfully, you can start setting up your worker.`,
      ); // TODO: give some quickstart instructions
    })
    .catch(function (err) {
      throw err;
    });
}
