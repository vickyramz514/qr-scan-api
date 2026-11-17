CREATE TYPE "GeofenceShape" AS ENUM ('CIRCLE', 'POLYGON');

ALTER TABLE "School"
  ADD COLUMN "geofenceType" "GeofenceShape" NOT NULL DEFAULT 'CIRCLE',
  ADD COLUMN "polygonCoordinates" JSONB;

ALTER TABLE "School"
  ADD CONSTRAINT "School_geofence_configuration_check"
  CHECK (
    ("geofenceType" = 'CIRCLE' AND "radiusMeters" > 0 AND "polygonCoordinates" IS NULL)
    OR
    ("geofenceType" = 'POLYGON'
      AND "radiusMeters" = 0
      AND "polygonCoordinates" IS NOT NULL
      AND jsonb_typeof("polygonCoordinates") = 'array'
      AND CASE
        WHEN jsonb_typeof("polygonCoordinates") = 'array' THEN jsonb_array_length("polygonCoordinates") >= 3
        ELSE false
      END)
  );

CREATE TABLE "SchoolDevice" (
  "schoolId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SchoolDevice_pkey" PRIMARY KEY ("schoolId", "deviceId")
);

CREATE INDEX "SchoolDevice_deviceId_idx" ON "SchoolDevice"("deviceId");

ALTER TABLE "SchoolDevice"
  ADD CONSTRAINT "SchoolDevice_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SchoolDevice"
  ADD CONSTRAINT "SchoolDevice_deviceId_fkey"
  FOREIGN KEY ("deviceId") REFERENCES "Device"("deviceId") ON DELETE CASCADE ON UPDATE CASCADE;
