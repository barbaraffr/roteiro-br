CREATE TABLE `trips` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`originName` varchar(255) NOT NULL,
	`originPlaceId` varchar(255) NOT NULL,
	`destinationName` varchar(255) NOT NULL,
	`destinationPlaceId` varchar(255) NOT NULL,
	`distanceKm` decimal(10,2) NOT NULL,
	`durationText` varchar(100) NOT NULL,
	`durationSeconds` int NOT NULL,
	`fuelConsumption` decimal(6,2) NOT NULL,
	`fuelPrice` decimal(6,2) NOT NULL,
	`fuelCost` decimal(10,2) NOT NULL,
	`tollCost` decimal(10,2) NOT NULL DEFAULT '0',
	`totalCost` decimal(10,2) NOT NULL,
	`polyline` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trips_id` PRIMARY KEY(`id`)
);
