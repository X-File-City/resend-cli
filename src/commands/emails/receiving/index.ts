import { Command } from '@commander-js/extra-typings';
import { listReceivingCommand } from './list';
import { getReceivingCommand } from './get';
import { listAttachmentsCommand } from './attachments';
import { getAttachmentCommand } from './attachment';

export const receivingCommand = new Command('receiving')
  .description('Manage received (inbound) emails — requires domain receiving to be enabled')
  .addCommand(listReceivingCommand)
  .addCommand(getReceivingCommand)
  .addCommand(listAttachmentsCommand)
  .addCommand(getAttachmentCommand);
