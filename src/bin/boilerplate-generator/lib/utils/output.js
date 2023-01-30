const { eraseLine } = require('ansi-escapes');
const ora = require('ora');
const ms = require('ms');

exports.info = function (msg) {
  console.log(`> ${msg}`);
};

exports.error = function (msg) {
  if (msg instanceof Error) {
    msg = msg.message;
  }

  console.error(`> Error! ${msg}`);
};

exports.success = function (msg) {
  console.log(`> Success! ${msg}`);
};

exports.time = function () {
  const start = new Date();
  return `[${ms(new Date() - start)}]`;
};

exports.wait = function (msg) {
  const spinner = ora(msg);
  spinner.color = 'blue';
  spinner.start();

  return function () {
    spinner.stop();
    process.stdout.write(eraseLine);
  };
};
