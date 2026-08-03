ALTER TABLE [dbo].[BillItem] WITH CHECK ADD CONSTRAINT [FK__BillItem__BillId__71D1E811] FOREIGN KEY ([BillId]) REFERENCES [dbo].[Bill] ([Id]);
ALTER TABLE [dbo].[BillItem] CHECK CONSTRAINT [FK__BillItem__BillId__71D1E811];

ALTER TABLE [dbo].[Card] WITH CHECK ADD CONSTRAINT [FK_Card_Flag_FlagId] FOREIGN KEY ([FlagId]) REFERENCES [dbo].[Flag] ([Id]) ON DELETE CASCADE;
ALTER TABLE [dbo].[Card] CHECK CONSTRAINT [FK_Card_Flag_FlagId];

ALTER TABLE [dbo].[Card] WITH CHECK ADD CONSTRAINT [FK_Card_User_UserId] FOREIGN KEY ([UserId]) REFERENCES [dbo].[User] ([Id]) ON DELETE CASCADE;
ALTER TABLE [dbo].[Card] CHECK CONSTRAINT [FK_Card_User_UserId];

ALTER TABLE [dbo].[Invoice] WITH CHECK ADD CONSTRAINT [FK_Invoice_Card_CardId] FOREIGN KEY ([CardId]) REFERENCES [dbo].[Card] ([Id]) ON DELETE CASCADE;
ALTER TABLE [dbo].[Invoice] CHECK CONSTRAINT [FK_Invoice_Card_CardId];

ALTER TABLE [dbo].[InvoiceItem] WITH CHECK ADD CONSTRAINT [FK_InvoiceItem_Category_CategoryId] FOREIGN KEY ([CategoryId]) REFERENCES [dbo].[Category] ([Id]) ON DELETE CASCADE;
ALTER TABLE [dbo].[InvoiceItem] CHECK CONSTRAINT [FK_InvoiceItem_Category_CategoryId];

ALTER TABLE [dbo].[InvoiceItem] WITH CHECK ADD CONSTRAINT [FK_InvoiceItem_Invoice_InvoiceId] FOREIGN KEY ([InvoiceId]) REFERENCES [dbo].[Invoice] ([Id]) ON DELETE CASCADE;
ALTER TABLE [dbo].[InvoiceItem] CHECK CONSTRAINT [FK_InvoiceItem_Invoice_InvoiceId];

ALTER TABLE [dbo].[Transaction] WITH CHECK ADD CONSTRAINT [FK_Transaction_User_UserId] FOREIGN KEY ([UserId]) REFERENCES [dbo].[User] ([Id]) ON DELETE CASCADE;
ALTER TABLE [dbo].[Transaction] CHECK CONSTRAINT [FK_Transaction_User_UserId];

ALTER TABLE [dbo].[TransactionItem] WITH CHECK ADD CONSTRAINT [CK_TYPE] CHECK ([Type]='INCOME' OR [Type]='OUTCOME');
ALTER TABLE [dbo].[TransactionItem] CHECK CONSTRAINT [CK_TYPE];

ALTER TABLE [dbo].[TransactionItem] WITH CHECK ADD CONSTRAINT [FK_TransactionItem_Transaction_TransactionId] FOREIGN KEY ([TransactionId]) REFERENCES [dbo].[Transaction] ([Id]) ON DELETE CASCADE;
ALTER TABLE [dbo].[TransactionItem] CHECK CONSTRAINT [FK_TransactionItem_Transaction_TransactionId];
