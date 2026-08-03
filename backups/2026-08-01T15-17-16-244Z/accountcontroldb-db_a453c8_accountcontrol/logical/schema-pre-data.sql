SET ANSI_NULLS ON;

SET QUOTED_IDENTIFIER ON;

IF OBJECT_ID(N'dbo.__EFMigrationsHistory', 'U') IS NULL
BEGIN
CREATE TABLE [dbo].[__EFMigrationsHistory] (
  [MigrationId] nvarchar(150) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
  [ProductVersion] nvarchar(32) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
  CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY CLUSTERED ([MigrationId])
);
END;

IF OBJECT_ID(N'dbo.Accounts', 'U') IS NULL
BEGIN
CREATE TABLE [dbo].[Accounts] (
  [AccountId] uniqueidentifier NOT NULL,
  [AccountDate] datetime2(7) NOT NULL,
  [Description] varchar(500) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
  [Value] float NOT NULL,
  CONSTRAINT [PK_Accounts] PRIMARY KEY CLUSTERED ([AccountId])
);
END;

IF OBJECT_ID(N'dbo.Cards', 'U') IS NULL
BEGIN
CREATE TABLE [dbo].[Cards] (
  [CardId] uniqueidentifier NOT NULL,
  [CardNumber] varchar(100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
  [Name] varchar(50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
  [DayInvoiceExpiration] int NOT NULL,
  [ExpirationDate] datetime2(7) NOT NULL,
  [FlagId] uniqueidentifier NOT NULL,
  [UserId] uniqueidentifier NOT NULL,
  [Active] bit NOT NULL,
  CONSTRAINT [PK_Cards] PRIMARY KEY CLUSTERED ([CardId])
);
END;

IF OBJECT_ID(N'dbo.Categories', 'U') IS NULL
BEGIN
CREATE TABLE [dbo].[Categories] (
  [CategoryId] uniqueidentifier NOT NULL,
  [Category] varchar(50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
  [Active] bit NOT NULL,
  CONSTRAINT [PK_Categories] PRIMARY KEY CLUSTERED ([CategoryId])
);
END;

IF OBJECT_ID(N'dbo.Flags', 'U') IS NULL
BEGIN
CREATE TABLE [dbo].[Flags] (
  [FlagId] uniqueidentifier NOT NULL,
  [Flag] varchar(50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
  [Active] bit NOT NULL,
  CONSTRAINT [PK_Flags] PRIMARY KEY CLUSTERED ([FlagId])
);
END;

IF OBJECT_ID(N'dbo.Invoices', 'U') IS NULL
BEGIN
CREATE TABLE [dbo].[Invoices] (
  [InvoiceId] uniqueidentifier NOT NULL,
  [Description] varchar(800) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
  [InvoiceControl] bigint NOT NULL,
  [InvoiceDate] datetime2(7) NOT NULL,
  [InvoiceMonth] varchar(30) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
  [InvoiceQuantity] int NOT NULL,
  [InvoiceValue] decimal(18, 2) NOT NULL,
  [InvoiceValueTotal] decimal(18, 2) NOT NULL,
  [UserId] uniqueidentifier NOT NULL,
  [CardId] uniqueidentifier NOT NULL,
  [CategoryId] uniqueidentifier NOT NULL,
  [PurchaseDate] datetime2(7) NOT NULL,
  CONSTRAINT [PK_Invoices] PRIMARY KEY CLUSTERED ([InvoiceId])
);
END;

IF OBJECT_ID(N'dbo.Users', 'U') IS NULL
BEGIN
CREATE TABLE [dbo].[Users] (
  [UserId] uniqueidentifier NOT NULL,
  [Name] varchar(70) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
  [Cpf] varchar(15) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
  [Email] varchar(80) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
  [Password] varchar(150) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
  [Address] varchar(50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
  [City] varchar(50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
  [Country] varchar(50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
  [Number] int NOT NULL,
  [State] varchar(50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
  [Active] bit NOT NULL,
  [Photo] varchar(300) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
  CONSTRAINT [PK_Users] PRIMARY KEY CLUSTERED ([UserId])
);
END;
