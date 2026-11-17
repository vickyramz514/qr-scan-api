DROP INDEX IF EXISTS "LocationSample_deviceId_recordedAt_idx";

CREATE INDEX "LocationSample_deviceId_recordedAt_receivedAt_idx"
ON "LocationSample"("deviceId", "recordedAt", "receivedAt");

CREATE INDEX "LocationSample_recordedAt_deviceId_idx"
ON "LocationSample"("recordedAt", "deviceId");
