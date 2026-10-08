-- CreateEnum
CREATE TYPE "ScanType" AS ENUM ('QR', 'BARCODE');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('RECEIVED', 'VALID', 'INVALID');

-- CreateTable
CREATE TABLE "Device" (
    "deviceId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "appVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("deviceId")
);

-- CreateTable
CREATE TABLE "Scan" (
    "id" UUID NOT NULL,
    "deviceId" TEXT NOT NULL,
    "code" VARCHAR(4096) NOT NULL,
    "type" "ScanType" NOT NULL,
    "status" "ScanStatus" NOT NULL DEFAULT 'RECEIVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Scan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Device_platform_idx" ON "Device"("platform");

-- CreateIndex
CREATE INDEX "Scan_deviceId_idx" ON "Scan"("deviceId");

-- CreateIndex
CREATE INDEX "Scan_createdAt_idx" ON "Scan"("createdAt");

-- CreateIndex
CREATE INDEX "Scan_type_idx" ON "Scan"("type");

-- CreateIndex
CREATE INDEX "Scan_status_idx" ON "Scan"("status");

-- AddForeignKey
ALTER TABLE "Scan" ADD CONSTRAINT "Scan_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("deviceId") ON DELETE CASCADE ON UPDATE CASCADE;
