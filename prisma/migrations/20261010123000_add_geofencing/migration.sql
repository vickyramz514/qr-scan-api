-- CreateEnum
CREATE TYPE "GeofenceEventType" AS ENUM ('ENTER', 'EXIT');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'IN_TRANSIT', 'ARRIVED', 'DELIVERED', 'FITTING_IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "radiusMeters" INTEGER NOT NULL DEFAULT 200,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliverySchool" (
    "deliveryId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "deviceId" TEXT,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliverySchool_pkey" PRIMARY KEY ("deliveryId","schoolId")
);

-- CreateTable
CREATE TABLE "DeliveryStatusEvent" (
    "id" UUID NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "fromStatus" "DeliveryStatus",
    "toStatus" "DeliveryStatus" NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceLocation" (
    "trackerId" TEXT NOT NULL,
    "deviceId" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceLocation_pkey" PRIMARY KEY ("trackerId")
);

-- CreateTable
CREATE TABLE "LocationSample" (
    "id" UUID NOT NULL,
    "trackerId" TEXT NOT NULL,
    "deviceId" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocationSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeofenceEvent" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "deviceId" TEXT,
    "eventType" "GeofenceEventType" NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL,
    "eventTime" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeofenceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "School_active_idx" ON "School"("active");

-- CreateIndex
CREATE INDEX "DeliverySchool_schoolId_idx" ON "DeliverySchool"("schoolId");

-- CreateIndex
CREATE INDEX "DeliverySchool_deviceId_idx" ON "DeliverySchool"("deviceId");

-- CreateIndex
CREATE INDEX "DeliverySchool_status_idx" ON "DeliverySchool"("status");

-- CreateIndex
CREATE INDEX "DeliveryStatusEvent_deliveryId_schoolId_changedAt_idx" ON "DeliveryStatusEvent"("deliveryId", "schoolId", "changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceLocation_deviceId_key" ON "DeviceLocation"("deviceId");

-- CreateIndex
CREATE INDEX "DeviceLocation_recordedAt_idx" ON "DeviceLocation"("recordedAt");

-- CreateIndex
CREATE INDEX "LocationSample_trackerId_recordedAt_idx" ON "LocationSample"("trackerId", "recordedAt");

-- CreateIndex
CREATE INDEX "LocationSample_deviceId_recordedAt_idx" ON "LocationSample"("deviceId", "recordedAt");

-- CreateIndex
CREATE INDEX "GeofenceEvent_schoolId_eventTime_idx" ON "GeofenceEvent"("schoolId", "eventTime");

-- CreateIndex
CREATE INDEX "GeofenceEvent_deviceId_eventTime_idx" ON "GeofenceEvent"("deviceId", "eventTime");

-- CreateIndex
CREATE INDEX "GeofenceEvent_receivedAt_idx" ON "GeofenceEvent"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Scan_code_key" ON "Scan"("code");

-- AddForeignKey
ALTER TABLE "DeliverySchool" ADD CONSTRAINT "DeliverySchool_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliverySchool" ADD CONSTRAINT "DeliverySchool_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliverySchool" ADD CONSTRAINT "DeliverySchool_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("deviceId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryStatusEvent" ADD CONSTRAINT "DeliveryStatusEvent_deliveryId_schoolId_fkey" FOREIGN KEY ("deliveryId", "schoolId") REFERENCES "DeliverySchool"("deliveryId", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceLocation" ADD CONSTRAINT "DeviceLocation_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("deviceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationSample" ADD CONSTRAINT "LocationSample_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("deviceId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeofenceEvent" ADD CONSTRAINT "GeofenceEvent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeofenceEvent" ADD CONSTRAINT "GeofenceEvent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("deviceId") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed the schools and route used by geofencing-poc. Existing rows are left in place.
INSERT INTO "School" ("id", "name", "latitude", "longitude", "radiusMeters", "active", "address", "updatedAt")
VALUES
    ('school-001', 'Greenwood Public School', 13.0827, 80.2707, 200, true, '12 Cathedral Road, Chennai', CURRENT_TIMESTAMP),
    ('school-002', 'Harbour View High School', 13.0875, 80.2707, 200, true, '88 Whannels Road, Chennai', CURRENT_TIMESTAMP),
    ('school-003', 'Marina Matriculation', 13.0827, 80.276, 200, true, '5 Santhome High Road, Chennai', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Delivery" ("id", "name")
VALUES ('route-001', 'Chennai morning school route')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "DeliverySchool" ("deliveryId", "schoolId", "status", "updatedAt")
VALUES
    ('route-001', 'school-001', 'PENDING', CURRENT_TIMESTAMP),
    ('route-001', 'school-002', 'PENDING', CURRENT_TIMESTAMP),
    ('route-001', 'school-003', 'PENDING', CURRENT_TIMESTAMP)
ON CONFLICT ("deliveryId", "schoolId") DO NOTHING;
