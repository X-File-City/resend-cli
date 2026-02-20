import { Command } from '@commander-js/extra-typings';
import { sendCommand } from './send';
import { batchCommand } from './batch';
import { receivingCommand } from './receiving/index';

export const emailsCommand = new Command('emails')
  .description('Send and manage emails')
  .addCommand(sendCommand)
  .addCommand(batchCommand)
  .addCommand(receivingCommand);
