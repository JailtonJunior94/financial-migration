:on error exit
SET NOCOUNT ON;
BEGIN TRANSACTION;
:r .\schema-pre-data.sql
:r .\data\dbo.__EFMigrationsHistory.sql
:r .\data\dbo.Accounts.sql
:r .\data\dbo.Cards.sql
:r .\data\dbo.Categories.sql
:r .\data\dbo.Flags.sql
:r .\data\dbo.Invoices.sql
:r .\data\dbo.Users.sql
:r .\schema-post-data.sql
COMMIT TRANSACTION;
