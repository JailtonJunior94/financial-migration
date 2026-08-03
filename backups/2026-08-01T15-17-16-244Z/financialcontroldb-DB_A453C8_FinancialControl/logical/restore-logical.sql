:on error exit
SET NOCOUNT ON;
BEGIN TRANSACTION;
:r .\schema-pre-data.sql
:r .\data\dbo.Bill.sql
:r .\data\dbo.BillItem.sql
:r .\data\dbo.Card.sql
:r .\data\dbo.Category.sql
:r .\data\dbo.Flag.sql
:r .\data\dbo.Invoice.sql
:r .\data\dbo.InvoiceItem.sql
:r .\data\dbo.Transaction.sql
:r .\data\dbo.TransactionItem.sql
:r .\data\dbo.User.sql
:r .\schema-post-data.sql
COMMIT TRANSACTION;
