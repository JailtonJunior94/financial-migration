SET ANSI_NULLS ON;

SET QUOTED_IDENTIFIER ON;

IF OBJECT_ID(N'dbo.Bill', 'U') IS NULL
BEGIN
CREATE TABLE [dbo].[Bill] (
  [Id] uniqueidentifier NOT NULL,
  [Date] datetime2(7) NOT NULL,
  [Total] decimal(18, 2) NULL,
  [SixtyPercent] decimal(18, 2) NULL,
  [FortyPercent] decimal(18, 2) NULL,
  [CreatedAt] datetime2(7) NOT NULL,
  [UpdatedAt] datetime2(7) NULL,
  [Active] bit NOT NULL,
  CONSTRAINT [PK__Bill__3214EC07FCC438A1] PRIMARY KEY CLUSTERED ([Id])
);
END;

IF OBJECT_ID(N'dbo.BillItem', 'U') IS NULL
BEGIN
CREATE TABLE [dbo].[BillItem] (
  [Id] uniqueidentifier NOT NULL,
  [BillId] uniqueidentifier NOT NULL,
  [Title] varchar(100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
  [Value] decimal(18, 2) NOT NULL,
  [CreatedAt] datetime2(7) NOT NULL,
  [UpdatedAt] datetime2(7) NULL,
  [Active] bit NOT NULL,
  CONSTRAINT [PK__BillItem__3214EC07D759346A] PRIMARY KEY CLUSTERED ([Id])
);
END;

IF OBJECT_ID(N'dbo.Card', 'U') IS NULL
BEGIN
CREATE TABLE [dbo].[Card] (
  [Id] uniqueidentifier NOT NULL,
  [UserId] uniqueidentifier NOT NULL,
  [FlagId] uniqueidentifier NOT NULL,
  [Name] varchar(50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
  [Number] varchar(50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
  [Description] varchar(100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
  [ClosingDay] int NOT NULL,
  [ExpirationDate] datetime2(7) NOT NULL,
  [CreatedAt] datetime2(7) NOT NULL,
  [UpdatedAt] datetime2(7) NULL,
  [Active] bit NOT NULL,
  CONSTRAINT [PK_Card] PRIMARY KEY CLUSTERED ([Id])
);
END;

IF OBJECT_ID(N'dbo.Category', 'U') IS NULL
BEGIN
CREATE TABLE [dbo].[Category] (
  [Id] uniqueidentifier NOT NULL,
  [Name] varchar(100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
  [Sequence] int NOT NULL,
  [CreatedAt] datetime2(7) NOT NULL,
  [UpdatedAt] datetime2(7) NULL,
  [Active] bit NOT NULL,
  CONSTRAINT [PK_Category] PRIMARY KEY CLUSTERED ([Id])
);
END;

IF OBJECT_ID(N'dbo.Flag', 'U') IS NULL
BEGIN
CREATE TABLE [dbo].[Flag] (
  [Id] uniqueidentifier NOT NULL,
  [Name] varchar(100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
  [CreatedAt] datetime2(7) NOT NULL,
  [UpdatedAt] datetime2(7) NULL,
  [Active] bit NOT NULL,
  CONSTRAINT [PK_Flag] PRIMARY KEY CLUSTERED ([Id])
);
END;

IF OBJECT_ID(N'dbo.Invoice', 'U') IS NULL
BEGIN
CREATE TABLE [dbo].[Invoice] (
  [Id] uniqueidentifier NOT NULL,
  [CardId] uniqueidentifier NOT NULL,
  [Date] datetime2(7) NOT NULL,
  [Total] float NOT NULL,
  [CreatedAt] datetime2(7) NOT NULL,
  [UpdatedAt] datetime2(7) NULL,
  [Active] bit NOT NULL,
  CONSTRAINT [PK_Invoice] PRIMARY KEY CLUSTERED ([Id])
);
END;

IF OBJECT_ID(N'dbo.InvoiceItem', 'U') IS NULL
BEGIN
CREATE TABLE [dbo].[InvoiceItem] (
  [Id] uniqueidentifier NOT NULL,
  [InvoiceId] uniqueidentifier NOT NULL,
  [CategoryId] uniqueidentifier NOT NULL,
  [PurchaseDate] datetime2(7) NOT NULL,
  [Description] varchar(800) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
  [TotalAmount] float NOT NULL,
  [Installment] int NULL,
  [InstallmentValue] float NOT NULL,
  [Tags] varchar(800) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
  [CreatedAt] datetime2(7) NOT NULL,
  [UpdatedAt] datetime2(7) NULL,
  [Active] bit NOT NULL,
  [InvoiceControl] bigint NULL,
  CONSTRAINT [PK_InvoiceItem] PRIMARY KEY CLUSTERED ([Id])
);
END;

IF OBJECT_ID(N'dbo.Transaction', 'U') IS NULL
BEGIN
CREATE TABLE [dbo].[Transaction] (
  [Id] uniqueidentifier NOT NULL,
  [UserId] uniqueidentifier NOT NULL,
  [Date] datetime2(7) NOT NULL,
  [Total] decimal(18, 2) NULL,
  [Income] decimal(18, 2) NULL,
  [Outcome] decimal(18, 2) NULL,
  [CreatedAt] datetime2(7) NOT NULL,
  [UpdatedAt] datetime2(7) NULL,
  [Active] bit NOT NULL,
  CONSTRAINT [PK_Transaction] PRIMARY KEY CLUSTERED ([Id])
);
END;

IF OBJECT_ID(N'dbo.TransactionItem', 'U') IS NULL
BEGIN
CREATE TABLE [dbo].[TransactionItem] (
  [Id] uniqueidentifier NOT NULL,
  [TransactionId] uniqueidentifier NOT NULL,
  [Title] varchar(100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
  [Value] decimal(18, 2) NOT NULL,
  [Type] varchar(10) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
  [CreatedAt] datetime2(7) NOT NULL,
  [UpdatedAt] datetime2(7) NULL,
  [Active] bit NOT NULL,
  [IsPaid] bit NULL,
  CONSTRAINT [PK_TransactionItem] PRIMARY KEY CLUSTERED ([Id])
);
END;

IF OBJECT_ID(N'dbo.User', 'U') IS NULL
BEGIN
CREATE TABLE [dbo].[User] (
  [Id] uniqueidentifier NOT NULL,
  [Name] varchar(50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
  [Email] varchar(100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
  [Password] varchar(300) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
  [CreatedAt] datetime2(7) NOT NULL,
  [UpdatedAt] datetime2(7) NULL,
  [Active] bit NOT NULL,
  CONSTRAINT [PK_User] PRIMARY KEY CLUSTERED ([Id])
);
END;
