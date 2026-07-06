#!/usr/bin/env node

import { Command } from 'commander';

const program = new Command();

program
  .name('jkt')
  .description('Interactive Jenkins CLI tool')
  .version('0.1.0');

program.parse();
